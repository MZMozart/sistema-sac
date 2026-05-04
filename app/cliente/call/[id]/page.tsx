'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { addDoc, collection, doc, getDoc, getDocs, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/contexts/auth-context'
import { LiveCallRoom } from '@/components/calls/live-call-room'
import { CallRealtimeChat } from '@/components/calls/call-realtime-chat'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { createNotification } from '@/lib/notifications'
import { createAuditLog } from '@/lib/audit'
import { rebalanceCallQueue } from '@/lib/call-queue'
import { ArrowLeft, Loader2, Phone } from 'lucide-react'
import { toast } from 'sonner'

export default function ClientCallPage() {
  const params = useParams()
  const id = params?.id as string
  const router = useRouter()
  const { user, userData } = useAuth()
  const [session, setSession] = useState<any>(null)
  const [company, setCompany] = useState<any>(null)
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [ratingSaved, setRatingSaved] = useState(false)
  const [savingRating, setSavingRating] = useState(false)
  const [selectedOption, setSelectedOption] = useState<string | null>(null)
  const [audioEnabled, setAudioEnabled] = useState(false)
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [mobileKeypadOpen, setMobileKeypadOpen] = useState(false)
  const [mobileCallPanel, setMobileCallPanel] = useState<'call' | 'chat'>('call')
  const [pendingHumanConfirmation, setPendingHumanConfirmation] = useState<any | null>(null)
  const [currentVisualCallNodeId, setCurrentVisualCallNodeId] = useState<string | null>(null)
  const spokenRef = useRef(false)
  const autoStartedRef = useRef(false)
  const speakingRef = useRef(false)
  const speechQueueRef = useRef<Promise<void>>(Promise.resolve())
  const localCallStreamRef = useRef<MediaStream | null>(null)
  const callAudioGraphRef = useRef<{
    context: AudioContext
    destination: MediaStreamAudioDestinationNode
    botGain: GainNode
    micStream: MediaStream
  } | null>(null)

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'call_sessions', id), (snap) => {
      if (snap.exists()) {
        setSession({ id: snap.id, ...snap.data() })
      }
    })

    return () => unsubscribe()
  }, [id])

  useEffect(() => {
    const loadCompany = async () => {
      if (!session?.companyId) return
      const companySnap = await getDoc(doc(db, 'companies', session.companyId))
      if (companySnap.exists()) {
        setCompany({ id: companySnap.id, ...companySnap.data() })
      }
    }

    loadCompany()
  }, [session?.companyId])

  useEffect(() => {
    const loadExistingRating = async () => {
      if (!user?.uid) return
      const ratingQuery = query(collection(db, 'ratings'), where('entityId', '==', id), where('clientId', '==', user.uid))
      const snapshot = await getDocs(ratingQuery)
      if (!snapshot.empty) setRatingSaved(true)
    }

    loadExistingRating()
  }, [id, user?.uid])

  useEffect(() => {
    if (!session?.id || !user?.uid || ['ended', 'completed'].includes(session.status)) return
    const updateHeartbeat = () => {
      const payload = {
        clientHeartbeatAt: serverTimestamp(),
        clientConnected: true,
        updatedAt: serverTimestamp(),
      }
      setDoc(doc(db, 'call_sessions', id), payload, { merge: true }).catch(() => null)
      setDoc(doc(db, 'calls', session.callId || id), payload, { merge: true }).catch(() => null)
    }
    updateHeartbeat()
    const timer = window.setInterval(updateHeartbeat, 15000)
    return () => window.clearInterval(timer)
  }, [id, session?.id, session?.callId, session?.status, user?.uid])

  const callVisualFlow = useMemo(() => company?.settings?.visualBotFlows?.call || session?.callVisualFlow || null, [company?.settings?.visualBotFlows?.call, session?.callVisualFlow])
  const visualCallNodes = useMemo(() => Array.isArray(callVisualFlow?.nodes) ? callVisualFlow.nodes : [], [callVisualFlow])
  const visualCallEdges = useMemo(() => Array.isArray(callVisualFlow?.edges) ? callVisualFlow.edges : [], [callVisualFlow])
  const callGreetingNode = useMemo(() => visualCallNodes.find((node: any) => node?.data?.kind === 'callGreeting') || null, [visualCallNodes])
  const currentVisualCallNode = useMemo(() => visualCallNodes.find((node: any) => node?.id === currentVisualCallNodeId) || callGreetingNode || null, [callGreetingNode, currentVisualCallNodeId, visualCallNodes])
  const visualCallOptions = useMemo(() => {
    if (!currentVisualCallNode) return []
    return visualCallEdges
      .filter((edge: any) => edge?.source === currentVisualCallNode.id)
      .map((edge: any) => visualCallNodes.find((node: any) => node?.id === edge.target && node?.data?.kind === 'callDigit'))
      .filter(Boolean)
      .map((node: any) => ({
        digit: String(node.data?.digit || '1'),
        label: node.data?.actionLabel || node.data?.title || `Opção ${node.data?.digit || '1'}`,
        speech: node.data?.text || `Você selecionou a opção ${node.data?.digit || '1'}.`,
        action: node.data?.action || 'info',
        actionLabel: node.data?.actionLabel || node.data?.title || null,
        visualNodeId: node.id,
      }))
  }, [currentVisualCallNode, visualCallEdges, visualCallNodes])
  const legacyCallBotOptions = useMemo(() => company?.settings?.callBotOptions || company?.uraOptions || session?.callBotOptions || [], [company, session?.callBotOptions])
  const callBotOptions = useMemo(() => visualCallOptions.length ? visualCallOptions : legacyCallBotOptions, [legacyCallBotOptions, visualCallOptions])
  const callBotGreeting = useMemo(() => callGreetingNode?.data?.text || company?.settings?.callBotGreeting || company?.botGreeting || session?.callBotGreeting || '', [callGreetingNode, company, session?.callBotGreeting])
  const callBotSpeech = useMemo(() => {
    const intro = callBotGreeting || `Olá, você ligou para ${session?.companyName || 'a empresa'}.`
    const optionsText = callBotOptions
      .filter((option: any) => option?.digit || option?.label)
      .map((option: any) => `Digite ${option?.digit || ''} para ${option?.label || option?.actionLabel || option?.description || 'continuar'}.`)
      .join(' ')
    return [intro, optionsText].filter(Boolean).join(' ')
  }, [callBotGreeting, callBotOptions, session?.companyName])

  useEffect(() => {
    if (!callGreetingNode?.id) return
    setCurrentVisualCallNodeId((current) => current || callGreetingNode.id)
  }, [callGreetingNode?.id])
  const botVoiceVolume = useMemo(() => {
    const configuredVolume = Number(company?.settings?.audioSettings?.botVoiceVolume ?? 100)
    return Math.max(0, Math.min(1, configuredVolume / 100))
  }, [company?.settings?.audioSettings?.botVoiceVolume])

  const enableAudio = async () => {
    let microphoneStream: MediaStream
    try {
      // WebRTC precisa de uma acao do usuario para liberar microfone e audio no navegador.
      microphoneStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          ...(company?.settings?.audioSettings?.inputDeviceId && company.settings.audioSettings.inputDeviceId !== 'default'
            ? { deviceId: { exact: company.settings.audioSettings.inputDeviceId } }
            : {}),
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
      const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext
      if (!AudioContextCtor) {
        localCallStreamRef.current = microphoneStream
        setLocalStream(microphoneStream)
      } else {
        const context = new AudioContextCtor()
        await context.resume().catch(() => null)
        const destination = context.createMediaStreamDestination()
        const botGain = context.createGain()
        botGain.gain.value = botVoiceVolume
        context.createMediaStreamSource(microphoneStream).connect(destination)
        botGain.connect(destination)
        botGain.connect(context.destination)
        callAudioGraphRef.current = { context, destination, botGain, micStream: microphoneStream }
        localCallStreamRef.current = destination.stream
        setLocalStream(destination.stream)
      }
      setAudioEnabled(true)
      setMobileCallPanel('call')
    } catch {
      toast.error('Permita o uso do microfone para iniciar a chamada no navegador.')
      return
    }
  }

  const fallbackSpeakText = (text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window) || !text.trim()) return Promise.resolve()
    return new Promise<void>((resolve) => {
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(text.slice(0, 900))
      utterance.lang = 'pt-BR'
      utterance.volume = botVoiceVolume
      utterance.rate = Number(company?.settings?.callBotVoiceSpeed || 1)
      utterance.onend = () => resolve()
      utterance.onerror = () => resolve()
      window.speechSynthesis.speak(utterance)
      window.setTimeout(resolve, Math.max(2500, Math.min(14000, text.length * 70)))
    })
  }

  const playSpeechNow = async (text: string) => {
    const cleanText = text.trim()
    if (!cleanText || speakingRef.current) return
    speakingRef.current = true
    try {
      // A voz da URA tenta usar OpenAI TTS; se a chave nao estiver configurada, cai para a voz do navegador.
      const response = await fetch('/api/voice/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: cleanText.slice(0, 4096),
          voice: company?.settings?.callBotOpenAIVoice || 'alloy',
          speed: company?.settings?.callBotVoiceSpeed || 1,
          model: 'tts-1',
        }),
      })

      if (!response.ok) {
        await fallbackSpeakText(cleanText)
        speakingRef.current = false
        return
      }

      const blob = await response.blob()
      const audioUrl = URL.createObjectURL(blob)
      const graph = callAudioGraphRef.current
      if (graph) {
        await graph.context.resume().catch(() => null)
        graph.botGain.gain.value = botVoiceVolume
        const audio = new Audio(audioUrl)
        audio.crossOrigin = 'anonymous'
        audio.preload = 'auto'
        audio.volume = 1
        const source = graph.context.createMediaElementSource(audio)
        source.connect(graph.botGain)
        await new Promise<void>((resolve) => {
          const finish = () => {
            source.disconnect()
            URL.revokeObjectURL(audioUrl)
            speakingRef.current = false
            resolve()
          }
          audio.onended = finish
          audio.onerror = finish
          audio.play().catch(async () => {
            URL.revokeObjectURL(audioUrl)
            await fallbackSpeakText(cleanText)
            speakingRef.current = false
            resolve()
          })
        })
      } else {
        URL.revokeObjectURL(audioUrl)
        await fallbackSpeakText(cleanText)
        speakingRef.current = false
      }
    } catch {
      await fallbackSpeakText(cleanText)
      speakingRef.current = false
    }
  }

  const speakText = async (text: string) => {
    const cleanText = text.trim()
    if (!cleanText) return
    const nextSpeech = speechQueueRef.current
      .catch(() => undefined)
      .then(() => playSpeechNow(cleanText))
    speechQueueRef.current = nextSpeech
    await nextSpeech
  }

  useEffect(() => {
    if (!session || !user || audioEnabled || autoStartedRef.current) return
    autoStartedRef.current = true
    enableAudio()
  }, [session?.id, user?.uid, company?.id])

  useEffect(() => {
    if (!audioEnabled || !callBotSpeech || !session || session.status === 'ended') return
    if (spokenRef.current) return

    spokenRef.current = true
    const timer = window.setTimeout(() => {
      speakText(callBotSpeech).catch(() => {
        fallbackSpeakText(callBotSpeech)
      })
    }, 900)

    return () => window.clearTimeout(timer)
  }, [audioEnabled, callBotSpeech, session])

  useEffect(() => {
    return () => {
      localCallStreamRef.current?.getTracks().forEach((track) => track.stop())
      callAudioGraphRef.current?.micStream.getTracks().forEach((track) => track.stop())
      callAudioGraphRef.current?.context.close().catch(() => null)
      localCallStreamRef.current = null
      callAudioGraphRef.current = null
    }
  }, [])

  const enterHumanQueue = async (option: any) => {
    if (!session) return
    const optionDigit = String(option?.digit || '')
    const optionLabel = option?.label || option?.actionLabel || option?.description || (optionDigit ? `Opção ${optionDigit}` : 'Atendimento humano')
    const queueReason = optionLabel || 'Atendimento humano'

    await setDoc(doc(db, 'call_sessions', id), {
      status: 'waiting',
      queuePosition: 9999,
      selectedOptionDigit: optionDigit || null,
      selectedOptionLabel: queueReason,
      selectedOptionDescription: option?.speech || option?.description || queueReason,
      queueReason,
      requestedHumanAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }, { merge: true })
    await setDoc(doc(db, 'calls', session.callId || id), {
      status: 'waiting',
      queuePosition: 9999,
      selectedOptionDigit: optionDigit || null,
      selectedOptionLabel: queueReason,
      selectedOptionDescription: option?.speech || option?.description || queueReason,
      queueReason,
      requestedHumanAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }, { merge: true })
    await rebalanceCallQueue(session.companyId)
    await createNotification({
      recipientCompanyId: session.companyId,
      title: 'Cliente entrou na fila de ligação',
      body: `${userData?.fullName || user?.displayName || session.clientName || 'Cliente'} pediu atendimento humano no protocolo ${session.protocolo}. Motivo: ${queueReason}.`,
      type: 'call',
      actionUrl: '/dashboard/telephony',
      entityId: id,
      entityType: 'call',
    })
    await createAuditLog({
      companyId: session.companyId,
      companyName: session.companyName,
      protocol: session.protocolo,
      callId: session.callId || id,
      channel: 'call',
      eventType: 'call_queue_entered',
      clientId: user?.uid || session.clientId,
      clientName: userData?.fullName || user?.displayName || session.clientName || 'Cliente',
      summary: `Cliente entrou na fila de atendimento humano. Motivo: ${queueReason}.`,
      metadata: { digit: optionDigit || null, label: queueReason },
    })
    speakText('Certo. Vou te colocar na fila para falar com um atendente. Aguarde na linha.').catch(() => null)
  }

  const finishCallByBot = async () => {
    if (!session) return
    await setDoc(doc(db, 'call_sessions', id), {
      status: 'ended',
      endedAt: serverTimestamp(),
      closedBy: 'bot',
      queuePosition: null,
      updatedAt: serverTimestamp(),
    }, { merge: true })
    await setDoc(doc(db, 'calls', session.callId || id), {
      status: 'ended',
      endedAt: serverTimestamp(),
      closedBy: 'bot',
      queuePosition: null,
      updatedAt: serverTimestamp(),
    }, { merge: true })
    await createAuditLog({
      companyId: session.companyId,
      companyName: session.companyName,
      protocol: session.protocolo,
      callId: session.callId || id,
      channel: 'call',
      eventType: 'call_bot_finished',
      clientId: user?.uid || session.clientId,
      clientName: userData?.fullName || user?.displayName || session.clientName || 'Cliente',
      summary: 'BOT encerrou a ligação a pedido do cliente.',
    })
  }

  const announceVisualOptions = async (nodeId?: string | null) => {
    if (!nodeId) return
    const available = visualCallEdges
      .filter((edge: any) => edge?.source === nodeId)
      .map((edge: any) => visualCallNodes.find((node: any) => node?.id === edge.target && node?.data?.kind === 'callDigit'))
      .filter(Boolean)

    if (!available.length) return
    const text = available
      .map((node: any) => `Digite ${node.data?.digit || ''} para ${node.data?.actionLabel || node.data?.title || 'continuar'}.`)
      .join(' ')
    await speakText(text)
  }

  const executeVisualTarget = async (targetNode: any, originOption: any) => {
    if (!targetNode) {
      await announceVisualOptions(currentVisualCallNode?.id || callGreetingNode?.id)
      return
    }

    if (targetNode.data?.kind === 'callText') {
      setCurrentVisualCallNodeId(targetNode.id)
      if (targetNode.data?.text) await speakText(targetNode.data.text)
      await announceVisualOptions(targetNode.id)
      return
    }

    if (targetNode.data?.kind === 'callAction') {
      const action = targetNode.data?.action || 'transfer'
      const actionOption = {
        ...originOption,
        action,
        label: targetNode.data?.actionLabel || targetNode.data?.title || originOption.label,
        actionLabel: targetNode.data?.actionLabel || targetNode.data?.title || originOption.actionLabel,
      }
      if (action === 'transfer') {
        await enterHumanQueue(actionOption)
        return
      }
      if (action === 'end') {
        if (targetNode.data?.actionLabel) await speakText(targetNode.data.actionLabel)
        await finishCallByBot()
        return
      }
      if (action === 'repeat') {
        await announceVisualOptions(currentVisualCallNode?.id || callGreetingNode?.id)
        return
      }
      if (targetNode.data?.actionLabel) await speakText(targetNode.data.actionLabel)
      await announceVisualOptions(targetNode.id)
      return
    }

    if (targetNode.data?.kind === 'callGreeting') {
      setCurrentVisualCallNodeId(targetNode.id)
      if (targetNode.data?.text) await speakText(targetNode.data.text)
      await announceVisualOptions(targetNode.id)
      return
    }

    if (targetNode.data?.kind === 'callDigit') {
      setCurrentVisualCallNodeId(currentVisualCallNode?.id || callGreetingNode?.id || null)
      await handleVisualCallOption({
        digit: String(targetNode.data?.digit || ''),
        label: targetNode.data?.actionLabel || targetNode.data?.title,
        speech: targetNode.data?.text,
        action: targetNode.data?.action || 'info',
        actionLabel: targetNode.data?.actionLabel || targetNode.data?.title,
        visualNodeId: targetNode.id,
      })
    }
  }

  const handleVisualCallOption = async (option: any) => {
    if (!session) return false
    const digitNode = visualCallNodes.find((node: any) => node?.id === option.visualNodeId)
    if (!digitNode) return false
    const optionDigit = String(option?.digit || digitNode.data?.digit || '')
    const optionLabel = option?.label || digitNode.data?.actionLabel || digitNode.data?.title || `Tecla ${optionDigit}`
    const spokenText = option?.speech || digitNode.data?.text || `Você selecionou a opção ${optionDigit}.`

    await updateDoc(doc(db, 'call_sessions', id), {
      selectedOptionDigit: optionDigit || null,
      selectedOptionLabel: optionLabel || null,
      selectedOptionDescription: spokenText || null,
      selectedOptionAt: serverTimestamp(),
      currentVisualCallNodeId: digitNode.id,
    })
    await setDoc(doc(db, 'calls', session.callId || id), {
      selectedOptionDigit: optionDigit || null,
      selectedOptionLabel: optionLabel || null,
      selectedOptionDescription: spokenText || null,
      selectedOptionAt: serverTimestamp(),
      currentVisualCallNodeId: digitNode.id,
    }, { merge: true })
    await createAuditLog({
      companyId: session.companyId,
      companyName: session.companyName,
      protocol: session.protocolo,
      callId: session.callId || id,
      channel: 'call',
      eventType: 'call_menu_selected',
      clientId: user?.uid || session.clientId,
      clientName: userData?.fullName || user?.displayName || session.clientName || 'Cliente',
      employeeId: session.employeeId || null,
      employeeName: session.employeeName || null,
      summary: `Cliente selecionou a tecla ${optionDigit || '-'} no fluxo visual da ligação.`,
      metadata: { digit: optionDigit || null, label: optionLabel || null, action: digitNode.data?.action || null, visualNodeId: digitNode.id },
    })

    if (spokenText) await speakText(spokenText)

    const targetId = visualCallEdges.find((edge: any) => edge?.source === digitNode.id)?.target
    const targetNode = visualCallNodes.find((node: any) => node?.id === targetId)
    if (targetNode) {
      await executeVisualTarget(targetNode, { ...option, label: optionLabel, speech: spokenText })
      return true
    }

    const action = digitNode.data?.action || option.action || 'info'
    if (action === 'transfer') {
      await enterHumanQueue({ ...option, label: optionLabel, speech: spokenText, action: 'transfer' })
      return true
    }
    if (action === 'end') {
      await finishCallByBot()
      return true
    }
    if (action === 'repeat') {
      await announceVisualOptions(currentVisualCallNode?.id || callGreetingNode?.id)
      return true
    }
    await announceVisualOptions(currentVisualCallNode?.id || callGreetingNode?.id)
    return true
  }

  const selectCallOption = async (option: any) => {
    if (!session) return
    const optionDigit = String(option?.digit || '')
    const optionLabel = option?.label || (optionDigit ? `Tecla ${optionDigit}` : 'Opção')
    setSelectedOption(optionDigit || String(optionLabel))
    try {
      if (option?.visualNodeId && await handleVisualCallOption(option)) return

      if (pendingHumanConfirmation) {
        if (optionDigit === '1') {
          const selected = pendingHumanConfirmation
          setPendingHumanConfirmation(null)
          await enterHumanQueue(selected)
          return
        }
        if (optionDigit === '2') {
          setPendingHumanConfirmation(null)
          await speakText('Tudo bem. Obrigado pelo contato. A ligação será encerrada.')
          await finishCallByBot()
          return
        }
        await speakText('Digite 1 para falar com um atendente ou 2 para encerrar.')
        return
      }

      const targetOption = option?.action === 'goto'
        ? callBotOptions.find((item: any) => String(item?.digit) === String(option?.targetDigit || ''))
        : null
      const spokenText = targetOption?.speech || option?.actionLabel || option?.speech || option?.description || option?.label || (optionDigit ? `Você selecionou a opção ${optionDigit}.` : '')
      await updateDoc(doc(db, 'call_sessions', id), {
        selectedOptionDigit: optionDigit || null,
        selectedOptionLabel: optionLabel || null,
        selectedOptionDescription: spokenText || null,
        selectedOptionAt: serverTimestamp(),
      })
      await setDoc(doc(db, 'calls', session.callId || id), {
        selectedOptionDigit: optionDigit || null,
        selectedOptionLabel: optionLabel || null,
        selectedOptionDescription: spokenText || null,
        selectedOptionAt: serverTimestamp(),
      }, { merge: true })
      await createAuditLog({
        companyId: session.companyId,
        companyName: session.companyName,
        protocol: session.protocolo,
        callId: session.callId || id,
        channel: 'call',
        eventType: 'call_menu_selected',
        clientId: user?.uid || session.clientId,
        clientName: userData?.fullName || user?.displayName || session.clientName || 'Cliente',
        employeeId: session.employeeId || null,
        employeeName: session.employeeName || null,
        summary: `Cliente selecionou a opção ${optionDigit || '-'} da ligação.`,
        metadata: {
          digit: optionDigit || null,
          label: optionLabel || null,
          action: option?.action || null,
          targetDigit: option?.targetDigit || null,
        },
      })
      if (option?.action === 'end') {
        if (spokenText) await speakText(spokenText)
        await finishCallByBot()
        return
      }
      if (option?.action === 'action') {
        await createNotification({
          recipientCompanyId: session.companyId,
          title: 'Ação interna disparada pela URA',
          body: `A ligação ${session.protocolo} executou a ação: ${option?.actionLabel || option?.label || 'ação interna'}.`,
          type: 'call',
          actionUrl: '/dashboard/telephony',
          entityId: id,
          entityType: 'call',
        })
      }
      if (spokenText) {
        await speakText(spokenText)
      }
      setPendingHumanConfirmation(targetOption || option)
      await speakText('Deseja falar com um atendente? Digite 1 para sim ou 2 para não.')
    } catch (error) {
      console.error('Call option registration error:', error)
      toast.error('Não foi possível registrar essa opção da ligação agora.')
    }
  }

  const submitRating = async () => {
    if (!user || !session || ratingSaved) return
    setSavingRating(true)
    try {
      await addDoc(collection(db, 'ratings'), {
        entityId: id,
        callId: id,
        protocol: session.protocolo,
        companyId: session.companyId,
        companyName: session.companyName,
        employeeId: session.employeeId || null,
        employeeName: session.employeeName || null,
        clientId: user.uid,
        clientName: userData?.fullName || user.displayName || 'Cliente',
        type: 'call',
        rating,
        comment,
        createdAt: serverTimestamp(),
      })

      await updateDoc(doc(db, 'calls', id), { rating, ratingComment: comment, ratedAt: serverTimestamp() })

      await createNotification({
        recipientCompanyId: session.companyId,
        recipientUserId: session.employeeId || undefined,
        title: 'Nova avaliação de ligação',
        body: `${userData?.fullName || user.displayName || 'Cliente'} avaliou a ligação ${session.protocolo} com nota ${rating}.`,
        type: 'rating',
        actionUrl: '/dashboard/ratings',
        entityId: id,
        entityType: 'rating',
      })

      setRatingSaved(true)
      toast.success('Avaliação enviada com sucesso.')
    } catch {
      toast.error('Não foi possível enviar sua avaliação agora.')
    } finally {
      setSavingRating(false)
    }
  }

  if (!session || !user) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>
  }

  return (
    <div className="fixed inset-0 z-50 flex h-[100dvh] w-screen touch-none select-none overflow-hidden overscroll-none bg-background" data-testid="client-call-page">
      <div className={`grid h-full min-h-0 w-full overflow-hidden bg-background ${session.status === 'active' ? 'xl:grid-cols-[minmax(0,1fr)_360px]' : ''}`}>
      <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      <header className="shrink-0 border-b border-border bg-background/95 px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] backdrop-blur">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()} data-testid="client-call-back-button">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          {company?.logoURL || session.companyLogoURL ? (
            <img src={company?.logoURL || session.companyLogoURL} alt={session.companyName || 'Empresa'} className="h-10 w-10 rounded-xl object-cover" />
          ) : null}
          <div className="min-w-0">
            <p className="truncate font-semibold">{session.companyName || 'Empresa'}</p>
            <p className="text-xs text-muted-foreground">Status da ligação: {session.status}</p>
          </div>
        </div>
      </header>

      <div className={`min-h-0 flex-1 overflow-hidden ${session.status === 'active' ? 'p-0 sm:p-4' : 'p-4'}`}>
        {audioEnabled && localStream ? (
          <LiveCallRoom
            roomId={id}
            callId={session.callId || id}
            protocol={session.protocolo}
            companyId={session.companyId}
            companyName={session.companyName || 'Empresa'}
            companyLogoUrl={company?.logoURL || session.companyLogoURL || ''}
            currentUserId={user.uid}
            currentUserName={userData?.fullName || user.displayName || 'Cliente'}
            mode="caller"
            clientUserId={user.uid}
            agentUserId={session.employeeId}
            audioSettings={company?.settings?.audioSettings}
            immersive
            initialLocalStream={localStream}
            callMenuOptions={callBotOptions}
            selectedCallMenuOption={selectedOption}
            showMobileKeypad={mobileKeypadOpen}
            onToggleMobileKeypad={() => setMobileKeypadOpen((current) => !current)}
            onSelectCallMenuOption={selectCallOption}
            onOpenMobileChat={() => setMobileCallPanel('chat')}
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.16),_rgba(2,6,23,0.96)_62%)] p-6 text-center text-white">
            <div>
              {company?.logoURL || session.companyLogoURL ? (
                <img src={company?.logoURL || session.companyLogoURL} alt={session.companyName || 'Empresa'} className="mx-auto mb-5 h-32 w-32 rounded-full object-cover shadow-2xl" />
              ) : (
                <div className="mx-auto mb-5 flex h-32 w-32 items-center justify-center rounded-full bg-white/10 text-white shadow-2xl">
                  <Phone className="h-12 w-12" />
                </div>
              )}
              <p className="text-xl font-semibold">{session.companyName || 'Empresa'}</p>
              <p className="mt-2 text-sm text-white/65">Preparando áudio e saudação automática...</p>
              <Button className="mt-4 bg-white text-slate-950 hover:bg-white/90" onClick={enableAudio} data-testid="client-call-enable-audio-button">
                Permitir microfone
              </Button>
            </div>
          </div>
        )}
      </div>

      {(session.status === 'ended' || session.status === 'completed') ? (
        <Card className="m-4 mt-0 shrink-0 glass border-border/80">
          <CardHeader>
            <CardTitle>Avaliar ligação</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3, 4, 5].map((value) => (
                <Button key={value} type="button" variant={rating >= value ? 'default' : 'outline'} onClick={() => setRating(value)} data-testid={`client-call-rating-${value}`}>
                  {value}★
                </Button>
              ))}
            </div>
            <Textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Conte como foi a experiência com a ligação" data-testid="client-call-rating-comment" />
            <Button onClick={submitRating} disabled={savingRating || ratingSaved} data-testid="client-call-rating-submit">
              {ratingSaved ? 'Avaliação enviada' : savingRating ? 'Enviando...' : 'Enviar avaliação'}
            </Button>
          </CardContent>
        </Card>
      ) : null}
      </div>
      {session.status === 'active' ? (
        <aside className="hidden min-h-0 flex-col overflow-hidden border-l border-border bg-card/40 xl:flex" data-testid="client-call-desktop-chat-aside">
          <CallRealtimeChat
            roomId={id}
            callId={session.callId || id}
            protocol={session.protocolo}
            companyId={session.companyId}
            companyName={session.companyName || 'Empresa'}
            currentUserId={user.uid}
            currentUserName={userData?.fullName || user.displayName || 'Cliente'}
            senderType="client"
            clientId={user.uid}
            employeeId={session.employeeId}
          />
        </aside>
      ) : null}
      {audioEnabled && mobileCallPanel === 'chat' ? (
        <div className="fixed inset-0 z-[60] flex flex-col bg-background xl:hidden" data-testid="client-call-mobile-chat-panel">
          <header className="shrink-0 border-b border-border bg-background/95 px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] backdrop-blur">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => setMobileCallPanel('call')} data-testid="client-call-mobile-chat-back-button">
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="min-w-0">
                <p className="truncate font-semibold">Chat da ligação</p>
                <p className="text-xs text-muted-foreground">Protocolo {session.protocolo}</p>
              </div>
            </div>
          </header>
          <div className="min-h-0 flex-1">
            <CallRealtimeChat
              roomId={id}
              callId={session.callId || id}
              protocol={session.protocolo}
              companyId={session.companyId}
              companyName={session.companyName || 'Empresa'}
              currentUserId={user.uid}
              currentUserName={userData?.fullName || user.displayName || 'Cliente'}
              senderType="client"
              clientId={user.uid}
              employeeId={session.employeeId}
            />
          </div>
        </div>
      ) : null}
      </div>
    </div>
  )
}
