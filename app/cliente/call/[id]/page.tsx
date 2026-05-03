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
  const spokenRef = useRef(false)
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null)

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

  const callBotGreeting = useMemo(() => company?.settings?.callBotGreeting || company?.botGreeting || '', [company])
  const callBotOptions = useMemo(() => company?.settings?.callBotOptions || company?.uraOptions || [], [company])
  const callBotSpeech = useMemo(() => {
    const intro = callBotGreeting || `Olá, você ligou para ${session?.companyName || 'a empresa'}.`
    const optionsText = callBotOptions
      .filter((option: any) => option?.digit || option?.label)
      .map((option: any) => `Digite ${option?.digit || ''} para ${option?.speech || option?.description || option?.label || 'continuar'}.`)
      .join(' ')
    return [intro, optionsText].filter(Boolean).join(' ')
  }, [callBotGreeting, callBotOptions, session?.companyName])
  const botVoiceVolume = useMemo(() => {
    const configuredVolume = Number(company?.settings?.audioSettings?.botVoiceVolume ?? 100)
    return Math.max(0, Math.min(1, configuredVolume / 100))
  }, [company?.settings?.audioSettings?.botVoiceVolume])

  const enableAudio = async () => {
    let stream: MediaStream
    try {
      // WebRTC precisa de uma acao do usuario para liberar microfone e audio no navegador.
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          ...(company?.settings?.audioSettings?.inputDeviceId && company.settings.audioSettings.inputDeviceId !== 'default'
            ? { deviceId: { exact: company.settings.audioSettings.inputDeviceId } }
            : {}),
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
      setLocalStream(stream)
      setAudioEnabled(true)
      setMobileCallPanel('call')
    } catch {
      toast.error('Permita o uso do microfone para iniciar a chamada no navegador.')
      return
    }

    if (callBotSpeech && !spokenRef.current && session?.status !== 'ended') {
      speakText(callBotSpeech).then(() => {
        spokenRef.current = true
      }).catch(() => {
        toast.error('Não foi possível tocar a voz automática da ligação agora.')
      })
    }
  }

  const speakText = async (text: string) => {
    if (!text.trim()) return
    // A voz da URA usa o texto configurado nos botoes para o cliente ouvir durante a ligacao.
    const response = await fetch('/api/voice/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: text.slice(0, 4096),
        voice: company?.settings?.callBotOpenAIVoice || 'alloy',
        speed: company?.settings?.callBotVoiceSpeed || 1,
        model: 'tts-1',
      }),
    })

    if (!response.ok) {
      throw new Error(await response.text())
    }

    const blob = await response.blob()
    const audioUrl = URL.createObjectURL(blob)
    if (ttsAudioRef.current) {
      ttsAudioRef.current.src = audioUrl
      ttsAudioRef.current.volume = botVoiceVolume
      await ttsAudioRef.current.play()
    }
  }

  useEffect(() => {
    if (!audioEnabled || !callBotSpeech || !session || session.status === 'ended') return
    if (spokenRef.current) return

    speakText(callBotSpeech).then(() => {
      spokenRef.current = true
    }).catch(() => null)
  }, [audioEnabled, callBotSpeech, session])

  useEffect(() => {
    return () => {
      localStream?.getTracks().forEach((track) => track.stop())
    }
  }, [localStream])

  const selectCallOption = async (option: any) => {
    if (!session) return
    const optionDigit = String(option?.digit || '')
    const optionLabel = option?.label || (optionDigit ? `Tecla ${optionDigit}` : 'Opção')
    setSelectedOption(optionDigit || String(optionLabel))
    try {
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
        await updateDoc(doc(db, 'call_sessions', id), { status: 'ended', endedAt: serverTimestamp(), closedBy: 'client_menu' })
        await updateDoc(doc(db, 'calls', session.callId || id), { status: 'ended', endedAt: serverTimestamp(), closedBy: 'client_menu' })
      }
      if (option?.action === 'transfer') {
        await createNotification({
          recipientCompanyId: session.companyId,
          title: 'Ligação priorizada pela URA',
          body: `O cliente escolheu ${option?.label || 'uma opção'} no protocolo ${session.protocolo}.`,
          type: 'call',
          actionUrl: '/dashboard/telephony',
          entityId: id,
          entityType: 'call',
        })
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
        speakText(spokenText).catch(() => null)
      }
    } catch (error) {
      console.error('Call option registration error:', error)
      toast.error('Não foi possível registrar essa opção da ligação agora.')
    }
  }

  const optionForDigit = (digit: string) => callBotOptions.find((option: any) => String(option?.digit) === digit)

  const renderDialpad = (dark = false) => (
    <div className="mx-auto grid max-w-sm grid-cols-3 gap-4" data-testid="client-call-dialpad">
      {dialpadKeys.map((key) => {
        const option = optionForDigit(key.digit)
        const selected = selectedOption === key.digit
        return (
          <button
            key={key.digit}
            type="button"
            onClick={() => selectCallOption(option || { digit: key.digit, label: `Tecla ${key.digit}` })}
            className={`aspect-square rounded-full border text-center shadow-lg transition active:scale-95 ${
              selected
                ? dark ? 'border-sky-300 bg-sky-300/25 text-white' : 'border-primary bg-primary/10 text-foreground'
                : dark ? 'border-white/10 bg-white/10 text-white hover:bg-white/15' : 'border-border bg-card/80 text-foreground hover:border-primary/60'
            }`}
            data-testid={`client-call-dialpad-key-${key.digit}`}
          >
            <span className="block text-3xl font-semibold leading-none">{key.digit}</span>
            <span className={`mt-1 block min-h-4 text-[10px] font-bold tracking-[0.22em] ${dark ? 'text-white/65' : 'text-muted-foreground'}`}>
              {option?.label ? String(option.label).slice(0, 12) : key.letters}
            </span>
          </button>
        )
      })}
    </div>
  )

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
    <div className="fixed inset-0 z-50 flex overflow-hidden bg-background" data-testid="client-call-page">
      <div className={`grid h-full min-h-0 w-full overflow-hidden bg-background ${session.status === 'active' ? 'xl:grid-cols-[minmax(0,1fr)_360px]' : ''}`}>
      <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      <header className="shrink-0 border-b border-border bg-background/95 px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] backdrop-blur">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()} data-testid="client-call-back-button">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0">
            <p className="truncate font-semibold">{session.companyName || 'Empresa'}</p>
            <p className="text-xs text-muted-foreground">Status da ligação: {session.status}</p>
          </div>
        </div>
      </header>

      {session.status !== 'active' ? (
        <div className="shrink-0 space-y-4 border-b border-border px-4 py-4">
          {typeof session?.queuePosition === 'number' ? (
            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-3 text-xs text-primary" data-testid="client-call-queue-banner">
              Sua posição na fila: {session.queuePosition} • Pessoas na sua frente: {Math.max(0, Number(session.queuePosition || 1) - 1)}
            </div>
          ) : null}
          {renderDialpad(false)}
        </div>
      ) : null}

      <div className={`min-h-0 flex-1 overflow-hidden ${session.status === 'active' ? 'p-0 sm:p-4' : 'p-4'}`}>
        {audioEnabled ? (
          <LiveCallRoom
            roomId={id}
            callId={session.callId || id}
            protocol={session.protocolo}
            companyId={session.companyId}
            companyName={session.companyName || 'Empresa'}
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
          <div className="flex h-full items-center justify-center rounded-[2rem] border border-border bg-card/60 p-6 text-center">
            <div>
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 text-white">
                <Phone className="h-7 w-7" />
              </div>
              <p className="text-lg font-semibold">Iniciar ligação</p>
              <p className="mt-2 text-sm text-muted-foreground">Toque para liberar o microfone e ouvir a saudação automática com as opções do teclado.</p>
              <Button className="mt-4" onClick={enableAudio} data-testid="client-call-enable-audio-button">
                Iniciar ligação e ouvir opções
              </Button>
            </div>
          </div>
        )}
      </div>
      <audio ref={ttsAudioRef} preload="auto" className="hidden" />

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
