'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { addDoc, arrayUnion, collection, doc, getDoc, getDocs, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore'
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { db, storage } from '@/lib/firebase'
import { createNotification } from '@/lib/notifications'
import { createAuditLog } from '@/lib/audit'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Grid3X3, Loader2, MessageSquare, Mic, MicOff, Phone, PhoneOff, Volume2 } from 'lucide-react'
import { toast } from 'sonner'

type CallMode = 'caller' | 'agent'

interface LiveCallRoomProps {
  roomId: string
  callId: string
  protocol?: string
  companyId: string
  companyName: string
  companyLogoUrl?: string
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
  onOpenMobileChat?: () => void
}

const rtcConfig: RTCConfiguration = {
  iceServers: [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }],
}

export function LiveCallRoom({ roomId, callId, protocol, companyId, companyName, companyLogoUrl, currentUserId, currentUserName, mode, clientUserId, agentUserId, audioSettings, immersive = false, initialLocalStream = null, callMenuOptions = [], selectedCallMenuOption = null, showMobileKeypad = false, onToggleMobileKeypad, onSelectCallMenuOption, onOpenMobileChat }: LiveCallRoomProps) {
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
  const recordingSourcesRef = useRef<MediaStreamAudioSourceNode[]>([])
  const localMuteStartedAtRef = useRef<number | null>(null)
  const mutedDurationRef = useRef(0)
  const connectionDropsRef = useRef(0)
  const recordingFinalizedRef = useRef(false)
  const manualEndingRef = useRef(false)

  const [status, setStatus] = useState<'connecting' | 'waiting' | 'ringing' | 'active' | 'post_service' | 'ended'>('connecting')
  const [muted, setMuted] = useState(false)
  const [mutedElapsed, setMutedElapsed] = useState(0)
  const [duration, setDuration] = useState(0)
  const [loading, setLoading] = useState(true)
  const [initError, setInitError] = useState<string | null>(null)
  const [retryToken, setRetryToken] = useState(0)
  const [remoteAudioReady, setRemoteAudioReady] = useState(false)
  const auditProtocol = protocol || callId

  const attachStreamForRecording = (stream: MediaStream) => {
    if (!audioContextRef.current || !destinationRef.current) return
    const source = audioContextRef.current.createMediaStreamSource(stream)
    source.connect(destinationRef.current)
    recordingSourcesRef.current.push(source)
  }

  const startRecording = () => {
    if (!destinationRef.current || mediaRecorderRef.current) return
    recordingFinalizedRef.current = false
    if (typeof MediaRecorder === 'undefined') {
      setDoc(doc(db, 'calls', callId), { recordingRequired: true, recordingStatus: 'unsupported', updatedAt: serverTimestamp() }, { merge: true }).catch(() => null)
      createAuditLog({
        companyId,
        companyName,
        clientId: clientUserId || null,
        employeeId: mode === 'agent' ? currentUserId : agentUserId || null,
        protocol: auditProtocol,
        callId,
        channel: 'call',
        eventType: 'call_recording_unavailable',
        summary: 'O navegador não ofereceu suporte para gravação automática da ligação.',
      }).catch(() => null)
      return
    }
    try {
      const recorder = MediaRecorder.isTypeSupported('audio/webm')
        ? new MediaRecorder(destinationRef.current.stream, { mimeType: 'audio/webm' })
        : new MediaRecorder(destinationRef.current.stream)
      recordedChunksRef.current = []
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) recordedChunksRef.current.push(event.data)
      }
      recorder.start(1000)
      mediaRecorderRef.current = recorder
      setDoc(doc(db, 'calls', callId), { recordingRequired: true, recordingStatus: 'recording', updatedAt: serverTimestamp() }, { merge: true }).catch(() => null)
    } catch {
      setDoc(doc(db, 'calls', callId), { recordingRequired: true, recordingStatus: 'failed_to_start', updatedAt: serverTimestamp() }, { merge: true }).catch(() => null)
      createAuditLog({
        companyId,
        companyName,
        clientId: clientUserId || null,
        employeeId: mode === 'agent' ? currentUserId : agentUserId || null,
        protocol: auditProtocol,
        callId,
        channel: 'call',
        eventType: 'call_recording_unavailable',
        summary: 'Não foi possível iniciar a gravação automática da ligação.',
      }).catch(() => null)
    }
  }

  const bindRemoteAudio = () => {
    const audio = remoteAudioRef.current
    const stream = remoteStreamRef.current
    if (!audio || !stream || stream.getAudioTracks().length === 0) return false
    if (audio.srcObject !== stream) {
      audio.srcObject = stream
    }
    audio.autoplay = true
    audio.muted = false
    audio.playsInline = true
    audio.volume = Math.max(0, Math.min(1, (audioSettings?.callVolume ?? 100) / 100))
    const outputId = audioSettings?.outputDeviceId
    if (outputId && outputId !== 'default' && typeof (audio as any).setSinkId === 'function') {
      ;(audio as any).setSinkId(outputId).catch(() => null)
    }
    return true
  }

  const playRemoteAudio = async () => {
    if (!bindRemoteAudio() || !remoteAudioRef.current) return
    try {
      await remoteAudioRef.current.play()
    } catch {
      // Alguns navegadores liberam áudio remoto apenas após uma interação direta na tela.
    }
  }

  const uploadRecording = async () => {
    if (!recordedChunksRef.current.length) return null
    const blob = new Blob(recordedChunksRef.current, { type: 'audio/webm' })
    let recordingUrl: string | null = null
    try {
      const fileRef = ref(storage, `calls/${companyId}/${callId}/recording-${Date.now()}.webm`)
      await uploadBytes(fileRef, blob)
      recordingUrl = await getDownloadURL(fileRef)
    } catch {
      const formData = new FormData()
      formData.append('file', blob, `recording-${callId}.webm`)
      formData.append('companyId', companyId)
      formData.append('callId', callId)
      formData.append('protocol', auditProtocol)
      const response = await fetch('/api/calls/recording', { method: 'POST', body: formData })
      if (response.ok) {
        const payload = await response.json()
        recordingUrl = payload.recordingUrl || null
      } else {
        const detail = await response.text().catch(() => '')
        await createAuditLog({
          companyId,
          companyName,
          clientId: clientUserId || null,
          employeeId: agentUserId || currentUserId,
          protocol: auditProtocol,
          callId,
          channel: 'call',
          eventType: 'call_recording_failed',
          summary: 'A gravação foi capturada, mas não pôde ser enviada para o servidor.',
          metadata: { detail: detail.slice(0, 500) },
        }).catch(() => null)
      }
    }
    if (!recordingUrl) return null
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
    await setDoc(doc(db, 'calls', callId), { recordingRequired: true, recordingStatus: 'saved', recordingUrl, updatedAt: serverTimestamp() }, { merge: true })
    return recordingUrl
  }

  const stopRecorderAndUpload = async () => {
    if (recordingFinalizedRef.current) return null
    const recorder = mediaRecorderRef.current
    if (!recorder) {
      return null
    }
    recordingFinalizedRef.current = true

    return new Promise<string | null>((resolve) => {
      recorder.onstop = async () => {
        const url = await uploadRecording().catch(() => null)
        if (!url) {
          await setDoc(doc(db, 'calls', callId), { recordingRequired: true, recordingStatus: 'not_saved', updatedAt: serverTimestamp() }, { merge: true }).catch(() => null)
        }
        resolve(url)
      }
      if (recorder.state !== 'inactive') {
        recorder.requestData()
        recorder.stop()
      } else {
        uploadRecording().then(resolve).catch(() => resolve(null))
      }
    })
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
      await stopRecorderAndUpload().catch(() => null)
    }
    mediaRecorderRef.current = null
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      await audioContextRef.current.close().catch(() => null)
    }
    audioContextRef.current = null
    destinationRef.current = null
    recordingSourcesRef.current = []
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

  useEffect(() => {
    let timer: NodeJS.Timeout | null = null
    if (muted && localMuteStartedAtRef.current) {
      timer = setInterval(() => {
        setMutedElapsed(Math.round((Date.now() - (localMuteStartedAtRef.current || Date.now())) / 1000))
      }, 1000)
    } else {
      setMutedElapsed(0)
    }
    return () => {
      if (timer) clearInterval(timer)
    }
  }, [muted])

  useEffect(() => {
    if (status !== 'ended') return
    if (manualEndingRef.current) return
    stopRecorderAndUpload().catch(() => null)
  }, [status])

  useEffect(() => {
    if (!remoteAudioReady) return
    bindRemoteAudio()
    const resume = () => playRemoteAudio().catch(() => null)
    window.addEventListener('pointerdown', resume)
    window.addEventListener('click', resume)
    window.addEventListener('keydown', resume)
    window.addEventListener('touchstart', resume)
    playRemoteAudio().catch(() => null)
    return () => {
      window.removeEventListener('pointerdown', resume)
      window.removeEventListener('click', resume)
      window.removeEventListener('keydown', resume)
      window.removeEventListener('touchstart', resume)
    }
  }, [remoteAudioReady, audioSettings?.callVolume, audioSettings?.outputDeviceId])

  const formattedDuration = useMemo(() => `${String(Math.floor(duration / 60)).padStart(2, '0')}:${String(duration % 60).padStart(2, '0')}`, [duration])
  const dialpadKeys = [
    { digit: '1', letters: '' },
    { digit: '2', letters: 'ABC' },
    { digit: '3', letters: 'DEF' },
    { digit: '4', letters: 'GHI' },
    { digit: '5', letters: 'JKL' },
    { digit: '6', letters: 'MNO' },
    { digit: '7', letters: 'PQRS' },
    { digit: '8', letters: 'TUV' },
    { digit: '9', letters: 'WXYZ' },
    { digit: '*', letters: '' },
    { digit: '0', letters: '+' },
    { digit: '#', letters: '' },
  ]
  const getOptionForDigit = (digit: string) => callMenuOptions.find((option) => String(option?.digit) === digit)

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

      const waitForRoomOffer = async () => {
        const immediateSnapshot = await getDoc(roomRef)
        const immediateData = immediateSnapshot.data()
        if (immediateData?.offer) return immediateData.offer

        return new Promise<any | null>((resolve) => {
          let unsubscribe: (() => void) | null = null
          const timeout = window.setTimeout(() => {
            unsubscribe?.()
            resolve(null)
          }, 15000)

          unsubscribe = onSnapshot(roomRef, (snapshot) => {
            const data = snapshot.data()
            if (data?.offer) {
              window.clearTimeout(timeout)
              unsubscribe?.()
              resolve(data.offer)
            }
            if (data?.status === 'ended') {
              window.clearTimeout(timeout)
              unsubscribe?.()
              resolve(null)
            }
          })
        })
      }

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
      startRecording()

      const peerConnection = new RTCPeerConnection(rtcConfig)
      peerConnectionRef.current = peerConnection

      const canUsePeer = () => isCurrentRun() && peerConnectionRef.current === peerConnection && peerConnection.signalingState !== 'closed'

      peerConnection.ontrack = (event) => {
        const incomingStream = event.streams[0] || new MediaStream([event.track])
        incomingStream.getTracks().forEach((track) => {
          if (!remoteStream.getTracks().some((currentTrack) => currentTrack.id === track.id)) {
            remoteStream.addTrack(track)
          }
        })
        attachStreamForRecording(incomingStream)
        setRemoteAudioReady(true)
        event.track.onunmute = () => playRemoteAudio().catch(() => null)
        bindRemoteAudio()
        playRemoteAudio().catch(() => null)
        window.setTimeout(() => playRemoteAudio().catch(() => null), 250)
        window.setTimeout(() => playRemoteAudio().catch(() => null), 1000)
      }

      peerConnection.onconnectionstatechange = async () => {
        if (!isCurrentRun()) return
        const state = peerConnection.connectionState
        if (state === 'connected') {
          startedAtRef.current = Date.now()
          setStatus('active')
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
        if (state === 'closed') {
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
          summary: 'Ligação criada com atendimento inicial do BOT.',
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
          if (data?.status === 'post_service') {
            setStatus('post_service')
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
        const offer = await waitForRoomOffer()
        if (!offer) {
          toast.error('A oferta da chamada ainda não está pronta. Aguarde alguns segundos e tente novamente.')
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

        await peerConnection.setRemoteDescription(new RTCSessionDescription(offer))
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
          if (snapshot.data()?.status === 'post_service') {
            setStatus('post_service')
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
    bindRemoteAudio()
    playRemoteAudio().catch(() => null)
  }, [audioSettings?.callVolume, audioSettings?.outputDeviceId])

  const toggleMute = async () => {
    const nextMuted = !muted
    localStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = !nextMuted
    })
    if (nextMuted) {
      localMuteStartedAtRef.current = Date.now()
      await setDoc(doc(db, 'calls', callId), {
        [`${mode === 'caller' ? 'client' : 'employee'}Muted`]: true,
        [`${mode === 'caller' ? 'client' : 'employee'}MutedAt`]: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true }).catch(() => null)
      await setDoc(doc(db, 'call_sessions', roomId), {
        [`${mode === 'caller' ? 'client' : 'employee'}Muted`]: true,
        updatedAt: serverTimestamp(),
      }, { merge: true }).catch(() => null)
      await createAuditLog({
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
      await setDoc(doc(db, 'calls', callId), {
        [`${mode === 'caller' ? 'client' : 'employee'}Muted`]: false,
        [`${mode === 'caller' ? 'client' : 'employee'}UnmutedAt`]: serverTimestamp(),
        [`${mode === 'caller' ? 'client' : 'employee'}MuteDurationSeconds`]: mutedDurationRef.current,
        updatedAt: serverTimestamp(),
      }, { merge: true }).catch(() => null)
      await setDoc(doc(db, 'call_sessions', roomId), {
        [`${mode === 'caller' ? 'client' : 'employee'}Muted`]: false,
        updatedAt: serverTimestamp(),
      }, { merge: true }).catch(() => null)
      await createAuditLog({
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
    const endedAt = Date.now()
    const totalDuration = startedAtRef.current ? Math.max(1, Math.floor((endedAt - startedAtRef.current) / 1000)) : duration

    if (localMuteStartedAtRef.current) {
      mutedDurationRef.current += Math.round((endedAt - localMuteStartedAtRef.current) / 1000)
      localMuteStartedAtRef.current = null
    }

    manualEndingRef.current = true
    setStatus('ended')

    const nextStatus = mode === 'agent' ? 'post_service' : 'completed'
    const nextCallState = mode === 'agent' ? 'POST_SERVICE' : 'FINISHED'
    const baseEndPayload = {
      status: nextStatus,
      callState: nextCallState,
      duration: totalDuration,
      muteDuration: mutedDurationRef.current,
      [`${mode === 'caller' ? 'client' : 'employee'}DisconnectedAt`]: serverTimestamp(),
      [`${mode === 'caller' ? 'client' : 'employee'}EndedBeforeEmployeeClose`]: mode === 'caller',
      endedByRole: mode === 'agent' ? 'employee' : 'client',
      micActiveDuration: Math.max(0, totalDuration - mutedDurationRef.current),
      connectionDrops: connectionDropsRef.current,
      recordingRequired: true,
      recordingStatus: 'saving',
      endedByName: currentUserName,
      updatedAt: serverTimestamp(),
      endedAt: serverTimestamp(),
      timeline: arrayUnion({ evento: mode === 'agent' ? 'agent_finished' : 'call_finished', encerrado_por: mode === 'agent' ? 'atendente' : 'cliente', timestamp: new Date().toISOString() }),
    }

    await Promise.all([
      setDoc(roomRef, {
        ...baseEndPayload,
        status: mode === 'agent' ? 'post_service' : 'ended',
        endedBy: currentUserId,
      }, { merge: true }).catch(() => null),
      setDoc(callRef, {
        ...baseEndPayload,
        companyId,
        companyName,
        employeeId: mode === 'agent' ? currentUserId : agentUserId || null,
        [`${mode}Name`]: currentUserName,
      }, { merge: true }).catch(() => null),
    ])

    peerConnectionRef.current?.close()

    const recordingUrl = await stopRecorderAndUpload().catch(async (error) => {
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
        eventType: 'call_recording_failed',
        summary: 'Não foi possível salvar a gravação da ligação.',
        metadata: { error: String(error?.message || error || 'erro desconhecido').slice(0, 500) },
      }).catch(() => null)
      return null
    })

    const callMessagesSnapshot = await getDocs(query(collection(db, 'call_messages'), where('callId', '==', callId))).catch(() => null)
    const callMessages = callMessagesSnapshot?.docs.map((item) => item.data() as any) || []
    const callFiles = callMessages.filter((item) => item.fileUrl).length

    await Promise.all([
      setDoc(roomRef, {
        recordingStatus: recordingUrl ? 'saved' : 'not_saved',
        recordingUrl: recordingUrl || null,
        callChatMessageCount: callMessages.length,
        callChatAttachmentCount: callFiles,
        updatedAt: serverTimestamp(),
      }, { merge: true }).catch(() => null),
      setDoc(callRef, {
        recordingUrl: recordingUrl || null,
        recordingStatus: recordingUrl ? 'saved' : 'not_saved',
        callChatMessageCount: callMessages.length,
        callChatAttachmentCount: callFiles,
        updatedAt: serverTimestamp(),
      }, { merge: true }).catch(() => null),
    ])

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
    }).catch(() => null)

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
    }).catch(() => null)

    localStreamRef.current?.getTracks().forEach((track) => track.stop())
    remoteStreamRef.current?.getTracks().forEach((track) => track.stop())
    audioContextRef.current?.close().catch(() => null)
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
          {muted ? `Desmutar (${mutedElapsed}s)` : 'Mutar'}
        </Button>
        <Button variant="destructive" onClick={endCall} data-testid="live-call-end-button">
          <PhoneOff className="mr-2 h-4 w-4" />
          Encerrar chamada
        </Button>
      </div>

      <div className="rounded-2xl border border-border bg-card/60 p-4 text-sm text-muted-foreground" data-testid="live-call-audio-card">
        <div className="flex items-center gap-2"><Volume2 className="h-4 w-4 text-primary" /> Áudio da ligação conectado automaticamente.</div>
        <p className="mt-2 text-xs text-muted-foreground">Volume da chamada: {audioSettings?.callVolume ?? 100}% • Entrada: {audioSettings?.inputDeviceId || 'default'} • Saída: {audioSettings?.outputDeviceId || 'default'}</p>
      </div>
    </>
  )

  const renderMobileImmersiveLayout = () => (
    <div className="relative flex h-full touch-none select-none flex-col overflow-hidden overscroll-none rounded-none bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.25),_rgba(15,23,42,0.96)_58%)] p-6 text-white md:hidden" data-testid="live-call-mobile-layout">
      <div className="pt-4 text-center">
        <Badge variant="outline" className="border-white/20 bg-white/10 text-white" data-testid="live-call-mobile-status-badge">{status}</Badge>
        <p className="mt-3 text-sm text-white/70" data-testid="live-call-mobile-company-name">{companyName}</p>
      </div>

      <div className="flex flex-1 items-center justify-center py-6 pb-24">
        <div className="text-center">
          {companyLogoUrl ? (
            <img src={companyLogoUrl} alt={companyName} className={`mx-auto h-44 w-44 rounded-full border border-white/10 object-cover shadow-2xl ${status === 'active' ? 'animate-pulse-glow' : ''}`} />
          ) : (
            <div className={`mx-auto flex h-44 w-44 items-center justify-center rounded-full border border-white/10 ${status === 'active' ? 'animate-pulse-glow bg-white/10' : 'bg-white/5'}`}>
              <Phone className="h-14 w-14" />
            </div>
          )}
          <p className="mt-6 text-3xl font-bold tracking-tight" data-testid="live-call-mobile-duration">{formattedDuration}</p>
          <p className="mt-3 text-sm text-white/70" data-testid="live-call-mobile-status-text">
            {status === 'active' ? 'Ligação em andamento' : status === 'ringing' ? 'Chamando atendente' : status === 'waiting' ? 'Aguardando na fila' : 'Conectando chamada'}
          </p>
        </div>
      </div>

      {showMobileKeypad ? (
        <div className="absolute inset-0 z-20 flex flex-col bg-slate-950/95 px-5 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-[calc(1rem+env(safe-area-inset-top))] backdrop-blur" data-testid="live-call-mobile-keypad-panel">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-white/65">Escolha uma opção</p>
              <p className="font-semibold">Discagem da ligação</p>
            </div>
            <Button variant="outline" className="border-white/15 bg-white/10 text-white hover:bg-white/15 hover:text-white" onClick={onToggleMobileKeypad} data-testid="live-call-mobile-keypad-close-button">
              Sair
            </Button>
          </div>
          <div className="mx-auto grid w-full max-w-xs flex-1 content-center grid-cols-3 gap-3">
            {dialpadKeys.map((key) => {
              const option = getOptionForDigit(key.digit)
              const selected = selectedCallMenuOption === key.digit
              return (
                <button
                  key={key.digit}
                  type="button"
                  onClick={() => onSelectCallMenuOption?.(option || { digit: key.digit, label: `Tecla ${key.digit}` })}
                  className={`aspect-square rounded-full border text-center shadow-xl transition active:scale-95 ${selected ? 'border-sky-300 bg-sky-300/25' : 'border-white/10 bg-white/10 hover:bg-white/15'}`}
                  data-testid={`live-call-mobile-keypad-option-${key.digit}`}
                >
                  <p className="text-2xl font-semibold leading-none">{key.digit}</p>
                  <p className="mt-1 min-h-4 text-[10px] font-bold tracking-[0.22em] text-white/65">{option?.label ? String(option.label).slice(0, 12) : key.letters}</p>
                </button>
              )
            })}
          </div>
        </div>
      ) : null}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <div className="pointer-events-auto mx-auto grid max-w-sm grid-cols-4 gap-2 rounded-[1.5rem] border border-white/10 bg-black/65 p-2 shadow-2xl backdrop-blur" data-testid="live-call-mobile-floating-navbar">
          <Button variant="destructive" className="h-14 flex-col gap-1 rounded-2xl px-2 text-[10px]" onClick={endCall} data-testid="live-call-mobile-end-button">
            <PhoneOff className="h-5 w-5" />
            Desligar
          </Button>
          <Button variant="ghost" className="h-14 flex-col gap-1 rounded-2xl bg-white/10 px-2 text-[10px] text-white hover:bg-white/15 hover:text-white" onClick={onToggleMobileKeypad} data-testid="live-call-mobile-keypad-toggle-button">
            <Grid3X3 className="h-5 w-5" />
            Discagem
          </Button>
          <Button variant="ghost" className="h-14 flex-col gap-1 rounded-2xl bg-white/10 px-2 text-[10px] text-white hover:bg-white/15 hover:text-white" onClick={onOpenMobileChat} data-testid="live-call-mobile-chat-button">
            <MessageSquare className="h-5 w-5" />
            Chat
          </Button>
          <Button variant="ghost" className="h-14 flex-col gap-1 rounded-2xl bg-white/10 px-2 text-[10px] text-white hover:bg-white/15 hover:text-white" onClick={toggleMute} data-testid="live-call-mobile-mute-button">
            {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            {muted ? `${mutedElapsed}s` : 'Mute'}
          </Button>
        </div>
      </div>
    </div>
  )

  return (
    <Card className={immersive ? 'flex h-full touch-none flex-col overflow-hidden overscroll-none rounded-none border-0 bg-transparent shadow-none md:rounded-[2rem] md:border md:border-border/80 md:bg-card/50' : 'glass border-border/80'}>
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />
      <CardHeader className={immersive ? 'hidden md:block' : ''}>
        <CardTitle>Ligação em tempo real</CardTitle>
        <CardDescription>{companyName} — voz WebRTC entre cliente e atendente.</CardDescription>
      </CardHeader>
      <CardContent className={immersive ? 'flex min-h-0 flex-1 flex-col justify-between overflow-hidden p-0 md:space-y-6 md:p-6' : 'space-y-6'}>
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
          </>
        )}
      </CardContent>
    </Card>
  )
}
