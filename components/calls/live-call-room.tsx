'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { addDoc, collection, doc, getDoc, getDocs, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore'
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { db, storage } from '@/lib/firebase'
import { createNotification } from '@/lib/notifications'
import { createAuditLog } from '@/lib/audit'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Grid3X3, Loader2, Mic, MicOff, Phone, PhoneOff, Volume2 } from 'lucide-react'
import { toast } from 'sonner'

type CallMode = 'caller' | 'agent'

interface LiveCallRoomProps {
  roomId: string
  callId: string
  protocol?: string
  companyId: string
  companyName: string
  currentUserId: string
  currentUserName: string
  mode: CallMode
  clientUserId?: string
  agentUserId?: string
  audioSettings?: {
    callVolume?: number
    botVoiceVolume?: number
    inputDeviceId?: string
    outputDeviceId?: string
  }
  immersive?: boolean
  initialLocalStream?: MediaStream | null
  callMenuOptions?: Array<{ digit?: string | number; label?: string; description?: string }>
  selectedCallMenuOption?: string | null
  showMobileKeypad?: boolean
  onToggleMobileKeypad?: () => void
  onSelectCallMenuOption?: (option: any) => void
}

const rtcConfig: RTCConfiguration = {
  iceServers: [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }],
}

export function LiveCallRoom({ roomId, callId, protocol, companyId, companyName, currentUserId, currentUserName, mode, clientUserId, agentUserId, audioSettings, immersive = false, initialLocalStream = null, callMenuOptions = [], selectedCallMenuOption = null, showMobileKeypad = false, onToggleMobileKeypad, onSelectCallMenuOption }: LiveCallRoomProps) {
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null)
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const remoteStreamRef = useRef<MediaStream | null>(null)
  const cleanupFnsRef = useRef<Array<() => void>>([])
  const setupRunIdRef = useRef(0)
  const startedAtRef = useRef<number | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const recordedChunksRef = useRef<Blob[]>([])
  const audioContextRef = useRef<AudioContext | null>(null)
  const destinationRef = useRef<MediaStreamAudioDestinationNode | null>(null)
  const localMuteStartedAtRef = useRef<number | null>(null)
  const mutedDurationRef = useRef(0)
  const connectionDropsRef = useRef(0)

  const [status, setStatus] = useState<'connecting' | 'waiting' | 'ringing' | 'active' | 'ended'>('connecting')
  const [muted, setMuted] = useState(false)
  const [duration, setDuration] = useState(0)
  const [loading, setLoading] = useState(true)
  const [initError, setInitError] = useState<string | null>(null)
  const [retryToken, setRetryToken] = useState(0)
  const [remoteAudioReady, setRemoteAudioReady] = useState(false)
  const [remoteNeedsInteraction, setRemoteNeedsInteraction] = useState(false)
  const auditProtocol = protocol || callId

  const attachStreamForRecording = (stream: MediaStream) => {
    if (!audioContextRef.current || !destinationRef.current) return
    const source = audioContextRef.current.createMediaStreamSource(stream)
    source.connect(destinationRef.current)
  }

  const startRecording = () => {
    if (!destinationRef.current || mediaRecorderRef.current || typeof MediaRecorder === 'undefined') return
    const recorder = MediaRecorder.isTypeSupported('audio/webm')
      ? new MediaRecorder(destinationRef.current.stream, { mimeType: 'audio/webm' })
      : new MediaRecorder(destinationRef.current.stream)
    recordedChunksRef.current = []
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) recordedChunksRef.current.push(event.data)
    }
    recorder.start(1000)
    mediaRecorderRef.current = recorder
  }

  const playRemoteAudio = async () => {
    if (!remoteAudioRef.current) return
    try {
      await remoteAudioRef.current.play()
      setRemoteNeedsInteraction(false)
    } catch {
      setRemoteNeedsInteraction(true)
    }
  }

  const uploadRecording = async () => {
    if (!recordedChunksRef.current.length) return null
    const blob = new Blob(recordedChunksRef.current, { type: 'audio/webm' })
    const fileRef = ref(storage, `calls/${companyId}/${callId}/recording-${Date.now()}.webm`)
    await uploadBytes(fileRef, blob)
    const recordingUrl = await getDownloadURL(fileRef)
    await createAuditLog({
      companyId,
      companyName,
      clientId: clientUserId || null,
      employeeId: agentUserId || currentUserId,
      protocol: auditProtocol,
      callId,
      channel: 'call',
      eventType: 'call_recording_saved',
      summary: 'Gravação da ligação salva com sucesso.',
      metadata: { recordingUrl },
    })
    return recordingUrl
  }

  const cleanupRoom = async (options?: { stopProvidedStream?: boolean }) => {
    cleanupFnsRef.current.forEach((cleanup) => cleanup())
    cleanupFnsRef.current = []
    peerConnectionRef.current?.close()
    peerConnectionRef.current = null
    if (localStreamRef.current && (options?.stopProvidedStream || localStreamRef.current !== initialLocalStream)) {
      localStreamRef.current.getTracks().forEach((track) => track.stop())
    }
    remoteStreamRef.current?.getTracks().forEach((track) => track.stop())
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    mediaRecorderRef.current = null
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      await audioContextRef.current.close().catch(() => null)
    }
    audioContextRef.current = null
    destinationRef.current = null
  }

  useEffect(() => {
    let timer: NodeJS.Timeout | null = null
    if (status === 'active') {
      timer = setInterval(() => setDuration((value) => value + 1), 1000)
    }
    return () => {
      if (timer) clearInterval(timer)
    }
  }, [status])

  const formattedDuration = useMemo(() => `${String(Math.floor(duration / 60)).padStart(2, '0')}:${String(duration % 60).padStart(2, '0')}`, [duration])

  useEffect(() => {
    const setup = async () => {
      const runId = setupRunIdRef.current + 1
      setupRunIdRef.current = runId
      setInitError(null)
      setLoading(true)

      await cleanupRoom()

      const isCurrentRun = () => setupRunIdRef.current === runId
      const roomRef = doc(db, 'call_sessions', roomId)
      const callRef = doc(db, 'calls', callId)
      const offerCandidates = collection(roomRef, 'offerCandidates')
      const answerCandidates = collection(roomRef, 'answerCandidates')

      const localStream = initialLocalStream || await navigator.mediaDevices.getUserMedia({
        audio: {
          ...(audioSettings?.inputDeviceId && audioSettings.inputDeviceId !== 'default' ? { deviceId: { exact: audioSettings.inputDeviceId } } : {}),
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
      if (!isCurrentRun()) {
        if (!initialLocalStream) {
          localStream.getTracks().forEach((track) => track.stop())
        }
        return
      }
      const remoteStream = new MediaStream()
      localStreamRef.current = localStream
      remoteStreamRef.current = remoteStream

      const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext
      if (!AudioContextCtor) {
        throw new Error('Este navegador não oferece suporte ao áudio da chamada.')
      }
      const audioContext = new AudioContextCtor()
      audioContextRef.current = audioContext
      await audioContext.resume().catch(() => null)
      if (!isCurrentRun() || audioContextRef.current !== audioContext) {
        await audioContext.close().catch(() => null)
        return
      }
      destinationRef.current = audioContext.createMediaStreamDestination()
      attachStreamForRecording(localStream)

      const peerConnection = new RTCPeerConnection(rtcConfig)
      peerConnectionRef.current = peerConnection

      const canUsePeer = () => isCurrentRun() && peerConnectionRef.current === peerConnection && peerConnection.signalingState !== 'closed'

      peerConnection.ontrack = (event) => {
        event.streams[0].getTracks().forEach((track) => remoteStream.addTrack(track))
        attachStreamForRecording(event.streams[0])
        setRemoteAudioReady(true)
        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = remoteStream
          remoteAudioRef.current.volume = Math.max(0, Math.min(1, (audioSettings?.callVolume ?? 100) / 100))
          const outputId = audioSettings?.outputDeviceId
          if (outputId && outputId !== 'default' && typeof (remoteAudioRef.current as any).setSinkId === 'function') {
            ;(remoteAudioRef.current as any).setSinkId(outputId).catch(() => null)
          }
          playRemoteAudio().catch(() => null)
        }
      }

      peerConnection.onconnectionstatechange = async () => {
        if (!isCurrentRun()) return
        const state = peerConnection.connectionState
        if (state === 'connected') {
          startedAtRef.current = Date.now()
          setStatus('active')
          startRecording()
          await updateDoc(roomRef, { status: 'active', activeAt: serverTimestamp() })
          await setDoc(callRef, { status: 'active', updatedAt: serverTimestamp() }, { merge: true })
          await createAuditLog({
            companyId,
            companyName,
            clientId: clientUserId || null,
            employeeId: mode === 'agent' ? currentUserId : agentUserId || null,
            employeeName: mode === 'agent' ? currentUserName : null,
            protocol: auditProtocol,
            callId,
            channel: 'call',
            eventType: 'call_answered',
            summary: 'Ligação conectada entre cliente e atendente.',
          })
          if (mode === 'agent' && clientUserId) {
            await createNotification({
              recipientCompanyId: companyId,
              recipientUserId: clientUserId,
              title: 'Sua ligação foi atendida',
              body: `${currentUserName} entrou na ligação em tempo real.`,
              type: 'call',
              actionUrl: `/cliente/call/${callId}`,
              entityId: callId,
              entityType: 'call',
              actorName: currentUserName,
            })
          }
        }
        if (state === 'disconnected' || state === 'failed') {
          connectionDropsRef.current += 1
          await createAuditLog({
            companyId,
            companyName,
            clientId: clientUserId || null,
            employeeId: mode === 'agent' ? currentUserId : agentUserId || null,
            protocol: auditProtocol,
            callId,
            channel: 'call',
            eventType: 'call_connection_drop',
            summary: 'Houve uma queda de conexão de áudio; reiniciando ICE.',
            metadata: { connectionState: state, drops: connectionDropsRef.current },
          })
          try {
            peerConnection.restartIce()
            await createAuditLog({
              companyId,
              companyName,
              clientId: clientUserId || null,
              employeeId: mode === 'agent' ? currentUserId : agentUserId || null,
              protocol: auditProtocol,
              callId,
              channel: 'call',
              eventType: 'call_reconnected',
              summary: 'Reconexão de áudio solicitada automaticamente.',
            })
          } catch {}
        }
        if (['disconnected', 'failed', 'closed'].includes(state)) {
          setStatus('ended')
        }
      }

      if (mode === 'caller') {
        setStatus('ringing')
        localStream.getTracks().forEach((track) => peerConnection.addTrack(track, localStream))
        await createAuditLog({
          companyId,
          companyName,
          clientId: currentUserId,
          clientName: currentUserName,
          employeeId: agentUserId || null,
          protocol: auditProtocol,
          callId,
          channel: 'call',
          eventType: 'call_created',
          summary: 'Ligação criada e aguardando atendimento humano.',
        })
        peerConnection.onicecandidate = async (event) => {
          if (event.candidate) {
            await addDoc(offerCandidates, event.candidate.toJSON())
          }
        }

        if (!canUsePeer()) return
        const offer = await peerConnection.createOffer()
        if (!canUsePeer()) return
        await peerConnection.setLocalDescription(offer)
        if (!isCurrentRun()) return
        await updateDoc(roomRef, { offer: { type: offer.type, sdp: offer.sdp }, status: 'ringing', updatedAt: serverTimestamp() })

        const unsubscribeRoom = onSnapshot(roomRef, async (snapshot) => {
          if (!isCurrentRun()) return
          const data = snapshot.data()
          if (!peerConnection.currentRemoteDescription && data?.answer && canUsePeer()) {
            const answerDescription = new RTCSessionDescription(data.answer)
            await peerConnection.setRemoteDescription(answerDescription)
          }
          if (data?.status === 'ended') {
            setStatus('ended')
          }
        })
        cleanupFnsRef.current.push(unsubscribeRoom)

        const unsubscribeAnswerCandidates = onSnapshot(answerCandidates, (snapshot) => {
          snapshot.docChanges().forEach((change) => {
            if (change.type === 'added' && canUsePeer()) {
              peerConnection.addIceCandidate(new RTCIceCandidate(change.doc.data())).catch(() => null)
            }
          })
        })
        cleanupFnsRef.current.push(unsubscribeAnswerCandidates)
      } else {
        const roomSnapshot = await getDoc(roomRef)
        const roomData = roomSnapshot.data()
        if (!roomData?.offer) {
          toast.error('A oferta da chamada ainda não está pronta.')
          setStatus('waiting')
          setLoading(false)
          return
        }

        setStatus('ringing')
        peerConnection.onicecandidate = async (event) => {
          if (event.candidate) {
            await addDoc(answerCandidates, event.candidate.toJSON())
          }
        }

        await peerConnection.setRemoteDescription(new RTCSessionDescription(roomData.offer))
        localStream.getTracks().forEach((track) => peerConnection.addTrack(track, localStream))
        const answer = await peerConnection.createAnswer()
        await peerConnection.setLocalDescription(answer)
        await updateDoc(roomRef, {
          answer: { type: answer.type, sdp: answer.sdp },
          employeeId: currentUserId,
          employeeName: currentUserName,
          status: 'active',
          answeredAt: serverTimestamp(),
        })

        await setDoc(callRef, { employeeId: currentUserId, employeeName: currentUserName, status: 'active', updatedAt: serverTimestamp() }, { merge: true })

        const unsubscribeOfferCandidates = onSnapshot(offerCandidates, (snapshot) => {
          snapshot.docChanges().forEach((change) => {
            if (change.type === 'added' && canUsePeer()) {
              peerConnection.addIceCandidate(new RTCIceCandidate(change.doc.data())).catch(() => null)
            }
          })
        })
        cleanupFnsRef.current.push(unsubscribeOfferCandidates)

        const unsubscribeRoom = onSnapshot(roomRef, (snapshot) => {
          if (!isCurrentRun()) return
          if (snapshot.data()?.status === 'ended') {
            setStatus('ended')
          }
        })
        cleanupFnsRef.current.push(unsubscribeRoom)
      }

      if (isCurrentRun()) {
        setLoading(false)
      }
    }

    setup().catch((error) => {
      console.error(error)
      setInitError(error?.message || 'Falha ao inicializar a chamada de voz.')
      toast.error('Não foi possível iniciar a chamada de voz.')
      setLoading(false)
    })

    return () => {
      cleanupRoom().catch(() => null)
    }
  }, [audioSettings?.inputDeviceId, callId, clientUserId, companyId, companyName, currentUserId, currentUserName, initialLocalStream, mode, retryToken, roomId])

  useEffect(() => {
    if (!remoteAudioRef.current) return
    remoteAudioRef.current.volume = Math.max(0, Math.min(1, (audioSettings?.callVolume ?? 100) / 100))
    const outputId = audioSettings?.outputDeviceId
    if (outputId && outputId !== 'default' && typeof (remoteAudioRef.current as any).setSinkId === 'function') {
      ;(remoteAudioRef.current as any).setSinkId(outputId).catch(() => null)
    }
  }, [audioSettings?.callVolume, audioSettings?.outputDeviceId])

  const toggleMute = () => {
    const nextMuted = !muted
    localStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = !nextMuted
    })
    if (nextMuted) {
      localMuteStartedAtRef.current = Date.now()
      createAuditLog({
        companyId,
        companyName,
        clientId: clientUserId || currentUserId,
        employeeId: mode === 'agent' ? currentUserId : agentUserId || null,
        protocol: auditProtocol,
        callId,
        channel: 'call',
        eventType: 'call_muted',
        summary: `${currentUserName} desligou o microfone.`,
      })
    } else {
      if (localMuteStartedAtRef.current) {
        mutedDurationRef.current += Math.round((Date.now() - localMuteStartedAtRef.current) / 1000)
        localMuteStartedAtRef.current = null
      }
      createAuditLog({
        companyId,
        companyName,
        clientId: clientUserId || currentUserId,
        employeeId: mode === 'agent' ? currentUserId : agentUserId || null,
        protocol: auditProtocol,
        callId,
        channel: 'call',
        eventType: 'call_unmuted',
        summary: `${currentUserName} reativou o microfone.`,
      })
    }
    setMuted(nextMuted)
  }

  const endCall = async () => {
    const roomRef = doc(db, 'call_sessions', roomId)
    const callRef = doc(db, 'calls', callId)
    const totalDuration = startedAtRef.current ? Math.max(1, Math.floor((Date.now() - startedAtRef.current) / 1000)) : duration
    if (localMuteStartedAtRef.current) {
      mutedDurationRef.current += Math.round((Date.now() - localMuteStartedAtRef.current) / 1000)
      localMuteStartedAtRef.current = null
    }

    const recordingUrl = await new Promise<string | null>((resolve) => {
      const recorder = mediaRecorderRef.current
      if (!recorder) {
        resolve(null)
        return
      }
      recorder.onstop = async () => {
        const url = await uploadRecording()
        resolve(url)
      }
      if (recorder.state !== 'inactive') {
        recorder.stop()
      } else {
        resolve(null)
      }
    })

    const callMessagesSnapshot = await getDocs(query(collection(db, 'call_messages'), where('callId', '==', callId)))
    const callMessages = callMessagesSnapshot.docs.map((item) => item.data() as any)
    const callFiles = callMessages.filter((item) => item.fileUrl).length

    await updateDoc(roomRef, {
      status: 'ended',
      endedBy: currentUserId,
      endedAt: serverTimestamp(),
      duration: totalDuration,
    })

    await setDoc(callRef, {
      companyId,
      companyName,
      employeeId: mode === 'agent' ? currentUserId : agentUserId || null,
      [`${mode}Name`]: currentUserName,
      status: 'completed',
      duration: totalDuration,
      muteDuration: mutedDurationRef.current,
      micActiveDuration: Math.max(0, totalDuration - mutedDurationRef.current),
      connectionDrops: connectionDropsRef.current,
      recordingUrl: recordingUrl || null,
      callChatMessageCount: callMessages.length,
      callChatAttachmentCount: callFiles,
      endedByName: currentUserName,
      updatedAt: serverTimestamp(),
      endedAt: serverTimestamp(),
    }, { merge: true })

    await createAuditLog({
      companyId,
      companyName,
      clientId: clientUserId || currentUserId,
      clientName: mode === 'caller' ? currentUserName : null,
      employeeId: mode === 'agent' ? currentUserId : agentUserId || null,
      employeeName: mode === 'agent' ? currentUserName : null,
      protocol: auditProtocol,
      callId,
      channel: 'call',
      eventType: 'call_ended',
      summary: `Ligação encerrada por ${currentUserName}.`,
      metadata: {
        duration: totalDuration,
        muteDuration: mutedDurationRef.current,
        micActiveDuration: Math.max(0, totalDuration - mutedDurationRef.current),
        connectionDrops: connectionDropsRef.current,
        callChatMessageCount: callMessages.length,
        callChatAttachmentCount: callFiles,
        recordingUrl,
      },
    })

    await createNotification({
      recipientCompanyId: companyId,
      recipientUserId: mode === 'agent' ? clientUserId : agentUserId,
      title: 'Ligação encerrada',
      body: `A ligação em tempo real com ${companyName} foi finalizada.`,
      type: 'call',
      actionUrl: mode === 'agent' ? `/cliente/call/${callId}` : '/dashboard/telephony',
      entityId: callId,
      entityType: 'call',
      actorName: currentUserName,
    })

    peerConnectionRef.current?.close()
    localStreamRef.current?.getTracks().forEach((track) => track.stop())
    remoteStreamRef.current?.getTracks().forEach((track) => track.stop())
    audioContextRef.current?.close().catch(() => null)
    setStatus('ended')
  }

  const renderDesktopLayout = () => (
    <>
      <div className="rounded-[2rem] border border-border bg-card/60 p-8 text-center" data-testid="live-call-desktop-summary-card">
        <div className={`mx-auto mb-4 flex h-28 w-28 items-center justify-center rounded-full ${status === 'active' ? 'animate-pulse-glow bg-gradient-primary text-white' : 'bg-secondary text-foreground'}`}>
          <Phone className="h-10 w-10" />
        </div>
        <Badge variant="outline" className="mb-3" data-testid="live-call-status-badge">{status}</Badge>
        <p className="text-3xl font-bold" data-testid="live-call-duration">{formattedDuration}</p>
      </div>

      <div className="flex flex-wrap gap-3" data-testid="live-call-desktop-controls">
        <Button variant="outline" onClick={toggleMute} data-testid="live-call-mute-button">
          {muted ? <MicOff className="mr-2 h-4 w-4" /> : <Mic className="mr-2 h-4 w-4" />}
          {muted ? 'Desmutar' : 'Mutar'}
        </Button>
        <Button variant="destructive" onClick={endCall} data-testid="live-call-end-button">
          <PhoneOff className="mr-2 h-4 w-4" />
          Encerrar chamada
        </Button>
      </div>

      <div className="rounded-2xl border border-border bg-card/60 p-4 text-sm text-muted-foreground" data-testid="live-call-audio-card">
        <div className="flex items-center gap-2"><Volume2 className="h-4 w-4 text-primary" /> Áudio remoto conectado automaticamente quando o outro participante entra.</div>
        <p className="mt-2 text-xs text-muted-foreground">Volume da chamada: {audioSettings?.callVolume ?? 100}% • Entrada: {audioSettings?.inputDeviceId || 'default'} • Saída: {audioSettings?.outputDeviceId || 'default'}</p>
        {remoteAudioReady ? (
          <Button variant="outline" className="mt-3" onClick={playRemoteAudio} data-testid="live-call-play-remote-audio-button">
            <Volume2 className="mr-2 h-4 w-4" />
            {remoteNeedsInteraction ? 'Ativar som do outro participante' : 'Reproduzir áudio remoto'}
          </Button>
        ) : null}
      </div>
    </>
  )

  const renderMobileImmersiveLayout = () => (
    <div className="relative flex h-full flex-col overflow-hidden rounded-none bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.25),_rgba(15,23,42,0.96)_58%)] p-6 text-white md:hidden" data-testid="live-call-mobile-layout">
      <div className="pt-4 text-center">
        <Badge variant="outline" className="border-white/20 bg-white/10 text-white" data-testid="live-call-mobile-status-badge">{status}</Badge>
        <p className="mt-3 text-sm text-white/70" data-testid="live-call-mobile-company-name">{companyName}</p>
      </div>

      <div className="flex flex-1 items-center justify-center py-6">
        <div className="text-center">
          <div className={`mx-auto flex h-40 w-40 items-center justify-center rounded-full border border-white/10 ${status === 'active' ? 'animate-pulse-glow bg-white/10' : 'bg-white/5'}`}>
            <Phone className="h-14 w-14" />
          </div>
          <p className="mt-6 text-3xl font-bold tracking-tight" data-testid="live-call-mobile-duration">{formattedDuration}</p>
          <p className="mt-3 text-sm text-white/70" data-testid="live-call-mobile-status-text">
            {status === 'active' ? 'Ligação em andamento' : status === 'ringing' ? 'Chamando atendente' : status === 'waiting' ? 'Aguardando na fila' : 'Conectando chamada'}
          </p>
          {remoteAudioReady ? (
            <Button variant="outline" className="mt-5 border-white/15 bg-white/10 text-white hover:bg-white/15" onClick={playRemoteAudio} data-testid="live-call-mobile-play-remote-audio-button">
              <Volume2 className="mr-2 h-4 w-4" />
              {remoteNeedsInteraction ? 'Ativar áudio' : 'Ouvir ligação'}
            </Button>
          ) : null}
        </div>
      </div>

      {callMenuOptions.length > 0 && showMobileKeypad ? (
        <div className="mb-24 rounded-[2rem] border border-white/10 bg-black/25 p-4 backdrop-blur" data-testid="live-call-mobile-keypad-panel">
          <p className="mb-3 text-xs uppercase tracking-[0.2em] text-white/60">Teclado numérico</p>
          <div className="grid grid-cols-3 gap-2">
            {callMenuOptions.map((option, index) => (
              <button
                key={`${option?.digit || index}`}
                type="button"
                onClick={() => onSelectCallMenuOption?.(option)}
                className={`rounded-2xl border px-3 py-4 text-left transition ${selectedCallMenuOption === String(option?.digit || option?.label || index) ? 'border-sky-300 bg-sky-300/20' : 'border-white/10 bg-white/5'}`}
                data-testid={`live-call-mobile-keypad-option-${option?.digit || index}`}
              >
                <p className="text-lg font-semibold">{option?.digit || index + 1}</p>
                <p className="mt-1 text-xs text-white/70">{option?.label || 'Opção'}</p>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <div className="pointer-events-auto mx-auto flex max-w-sm items-center justify-between rounded-full border border-white/10 bg-black/60 px-4 py-3 shadow-2xl backdrop-blur" data-testid="live-call-mobile-floating-navbar">
          <Button variant="ghost" className="rounded-full bg-white/10 text-white hover:bg-white/15 hover:text-white" onClick={toggleMute} data-testid="live-call-mobile-mute-button">
            {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </Button>
          {callMenuOptions.length > 0 ? (
            <Button variant="ghost" className="rounded-full bg-white/10 text-white hover:bg-white/15 hover:text-white" onClick={onToggleMobileKeypad} data-testid="live-call-mobile-keypad-toggle-button">
              <Grid3X3 className="h-5 w-5" />
            </Button>
          ) : null}
          <Button variant="destructive" className="rounded-full" onClick={endCall} data-testid="live-call-mobile-end-button">
            <PhoneOff className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  )

  return (
    <Card className={immersive ? 'flex h-full flex-col overflow-hidden rounded-none border-0 bg-transparent shadow-none md:rounded-[2rem] md:border md:border-border/80 md:bg-card/50' : 'glass border-border/80'}>
      <CardHeader className={immersive ? 'hidden md:block' : ''}>
        <CardTitle>Ligação em tempo real</CardTitle>
        <CardDescription>{companyName} — voz WebRTC entre cliente e atendente.</CardDescription>
      </CardHeader>
      <CardContent className={immersive ? 'flex min-h-0 flex-1 flex-col justify-between space-y-6' : 'space-y-6'}>
        {loading ? (
          <div className="flex items-center justify-center py-10"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>
        ) : initError ? (
          <div className="rounded-3xl border border-destructive/30 bg-destructive/5 p-6 text-center">
            <p className="font-medium text-destructive">Não foi possível iniciar a chamada de voz.</p>
            <p className="mt-2 text-sm text-muted-foreground">{initError}</p>
            <Button className="mt-4" onClick={() => { setLoading(true); setRetryToken((value) => value + 1) }} data-testid="live-call-retry-button">
              Tentar novamente
            </Button>
          </div>
        ) : (
          <>
            {immersive ? (
              <>
                <div className="hidden md:flex md:flex-1 md:flex-col md:space-y-6">{renderDesktopLayout()}</div>
                {renderMobileImmersiveLayout()}
              </>
            ) : renderDesktopLayout()}
            <audio ref={remoteAudioRef} autoPlay playsInline />
          </>
        )}
      </CardContent>
    </Card>
  )
}
