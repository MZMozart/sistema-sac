'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { ChatHeader } from '@/components/chat/ChatHeader';
import { MessageList } from '@/components/chat/MessageList';
import { MessageInput } from '@/components/chat/MessageInput';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, ArrowLeft, Building2, Check, CheckCheck, User, Bot, Paperclip, Send } from 'lucide-react';
import { toast } from 'sonner';
import { db } from '@/lib/firebase';
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  serverTimestamp,
  getDocs,
  limit
} from 'firebase/firestore';
import { formatTime } from '@/lib/utils';
import { createNotification } from '@/lib/notifications';
import { createAuditLog } from '@/lib/audit';
import { rebalanceChatQueue } from '@/lib/chat-queue';
import { maybeHandleChatInactivity } from '@/lib/chat-inactivity';
import { getChatFlowButtons, getChatFlowTargetMessage } from '@/lib/bot-flow';
import type { Chat, Message, Company } from '@/lib/types';

interface PageProps {
  params: { id: string };
}

function resolveConfiguredReply(message: string, company: any) {
  const lowered = message.toLowerCase()
  const intents = Array.isArray(company?.settings?.botIntents) ? company.settings.botIntents : []
  const match = intents.find((intent: any) => {
    const examples = Array.isArray(intent.examples) ? intent.examples : []
    return examples.some((example: string) => lowered.includes(example.toLowerCase())) || lowered.includes((intent.name || '').toLowerCase())
  })

  if (match?.responses?.length) {
    return { reply: match.responses[0], resolved: false, needsHuman: false }
  }

  const transferKeywords = Array.isArray(company?.settings?.botTransferKeywords) ? company.settings.botTransferKeywords : []
  if (transferKeywords.some((keyword: string) => lowered.includes(keyword.toLowerCase()))) {
    return {
      reply: `${company?.nomeFantasia || company?.razaoSocial || 'Empresa'}: recebi seu pedido de atendimento humano e vou sinalizar a fila da equipe agora.`,
      resolved: false,
      needsHuman: true,
    }
  }

  return null
}

function isAffirmative(message: string) {
  return /^(sim|s|ok|isso|resolvido|certo)$/i.test(message.trim())
}

function isNegative(message: string) {
  return /^(nao|não|n|negativo|ainda nao|ainda não)$/i.test(message.trim())
}

async function assignLeastLoadedAttendant(companyId: string) {
  const [employeesSnapshot, chatsSnapshot] = await Promise.all([
    getDocs(query(collection(db, 'employees'), where('companyId', '==', companyId))),
    getDocs(query(collection(db, 'chats'), where('companyId', '==', companyId))),
  ])

  const employees = employeesSnapshot.docs
    .map((item) => ({ id: item.id, ...(item.data() as any) }))
    .filter((employee: any) => ['attendant', 'employee', 'manager', 'owner'].includes(employee.role))

  const chats = chatsSnapshot.docs.map((item) => ({ id: item.id, ...(item.data() as any) }))

  const scored = employees
    .map((employee: any) => ({
      employee,
      load: chats.filter((chat: any) => chat.employeeId === employee.userId && ['active', 'waiting', 'pending_resolution'].includes(chat.status)).length,
    }))
    .sort((a, b) => a.load - b.load)

  return scored[0] || null
}

export default function ClientChatPage() {
  const params = useParams();
  const id = params?.id as string;
  const router = useRouter();
  const { user, userData, loading: authLoading } = useAuth();

  const [chat, setChat] = useState<Chat | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [rating, setRating] = useState(5);
  const [ratingComment, setRatingComment] = useState('');
  const [ratingSaved, setRatingSaved] = useState(false);
  const [savingRating, setSavingRating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const botButtons = useMemo(() => getChatFlowButtons(company, chat), [company, chat]);
  const isStructuredBotFlow = Boolean(chat?.status === 'bot' && botButtons.length > 0 && !(chat as any)?.botAwaitingResolvedConfirmation && !(chat as any)?.botAwaitingAnythingElse)

  // Buscar chat e empresa
  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'chats', id), async (chatDoc) => {
      try {
        if (chatDoc.exists()) {
          const chatData = { id: chatDoc.id, ...chatDoc.data() } as Chat;
          setChat(chatData);

          if (chatData.companyId) {
            const companyDoc = await getDoc(doc(db, 'companies', chatData.companyId));
            if (companyDoc.exists()) {
              setCompany({ id: companyDoc.id, ...companyDoc.data() } as Company);
            }
          }
        } else {
          setChat(null)
        }
      } catch {
        toast.error('Erro ao carregar conversa');
      } finally {
        setLoading(false);
      }
    })

    return () => unsubscribe()
  }, [id]);

  useEffect(() => {
    const loadExistingRating = async () => {
      if (!id || !user?.uid) return
      const ratingQuery = query(collection(db, 'ratings'), where('entityId', '==', id), where('clientId', '==', user.uid), limit(1))
      const snapshot = await getDocs(ratingQuery)
      if (!snapshot.empty) {
        setRatingSaved(true)
      }
    }

    loadExistingRating()
  }, [id, user?.uid])

  // Ouvir mensagens em tempo real
  useEffect(() => {
    if (!id) return;

    const messagesQuery = query(
      collection(db, 'messages'),
      where('chatId', '==', id),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(messagesQuery, snapshot => {
      const msgs: Message[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date()
      })) as unknown as Message[];

      setMessages(msgs);

      // Scroll automático para o final
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    });

    return () => unsubscribe();
  }, [id]);

  useEffect(() => {
    if (!chat || !company || messages.length === 0) return;

    const timer = window.setInterval(() => {
      maybeHandleChatInactivity({
        chat,
        companyName: company?.nomeFantasia || company?.razaoSocial || chat.companyName,
        messages,
      }).catch(() => null)
    }, 30000)

    return () => window.clearInterval(timer)
  }, [chat, company, messages])

  // Marcar como lidas
  useEffect(() => {
    if (!chat || !user) return;
    const markAsRead = async () => {
      try {
        await updateDoc(doc(db, 'chats', id), { unreadCount: 0 });
      } catch {}
    };
    markAsRead();
  }, [chat, user, id]);

  // Redirecionar se não autenticado
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login');
    }
  }, [user, authLoading, router]);

  const handleSend = async (text: string) => {
    if (!text.trim() || !user || !chat) return;
    if (isStructuredBotFlow) {
      toast.info('Use os botões do BOT para seguir o fluxo deste atendimento.')
      return
    }
    setSending(true);

    try {
      await addDoc(collection(db, 'messages'), {
        chatId: id,
        companyId: chat.companyId,
        content: text,
        type: 'text',
        senderType: 'client',
        senderId: user.uid,
        senderName: userData?.fullName || user.displayName || 'Cliente',
        senderPhotoURL: user.photoURL || null,
        createdAt: serverTimestamp(),
        read: false
      });

      await createAuditLog({
        companyId: chat.companyId,
        companyName: company?.nomeFantasia || company?.razaoSocial || chat.companyName,
        protocol: chat.protocolo,
        chatId: id,
        channel: 'chat',
        eventType: 'chat_message',
        clientId: user.uid,
        clientName: userData?.fullName || user.displayName || 'Cliente',
        employeeId: chat.employeeId || null,
        employeeName: (chat as any).employeeName || null,
        summary: 'Cliente enviou uma nova mensagem no chat.',
        metadata: { message: text },
      })

      await updateDoc(doc(db, 'chats', id), {
        lastMessage: text,
        lastMessageAt: serverTimestamp(),
        lastActivity: serverTimestamp(),
        inactiveActor: null,
        inactiveDurationSeconds: 0,
        status: chat.status === 'closed' ? 'closed' : chat.status
      });

      setNewMessage('');

      if (company && chat.status === 'bot') {
        if (company.botActive === false) {
          const assignment = await assignLeastLoadedAttendant(chat.companyId)
          await updateDoc(doc(db, 'chats', id), {
            status: 'waiting',
            employeeId: assignment?.employee?.userId || null,
            employeeName: assignment?.employee?.name || assignment?.employee?.email || null,
            botResolved: false,
            lastMessageAt: serverTimestamp(),
          })
          await addDoc(collection(db, 'messages'), {
            chatId: id,
            companyId: chat.companyId,
            content: 'O BOT está pausado nesta empresa. Seu atendimento foi enviado direto para a fila humana.',
            type: 'text',
            senderType: 'bot',
            senderId: 'bot',
            senderName: `${company.nomeFantasia || company.razaoSocial} BOT`,
            createdAt: serverTimestamp(),
            read: false,
          })
          await rebalanceChatQueue(chat.companyId)
          return
        }

        if ((chat as any).botAwaitingResolvedConfirmation) {
          if (isAffirmative(text)) {
            const followUp = 'Ótimo! Precisa de mais alguma coisa?'
            await addDoc(collection(db, 'messages'), {
              chatId: id,
              companyId: chat.companyId,
              content: followUp,
              type: 'text',
              senderType: 'bot',
              senderId: 'bot',
              senderName: `${company.nomeFantasia || company.razaoSocial} BOT`,
              createdAt: serverTimestamp(),
              read: false,
            })
            await updateDoc(doc(db, 'chats', id), {
              botAwaitingResolvedConfirmation: false,
              botAwaitingAnythingElse: true,
              botResolved: true,
              lastMessage: followUp,
              lastMessageAt: serverTimestamp(),
            })
            return
          }

          if (isNegative(text)) {
            const assignment = await assignLeastLoadedAttendant(chat.companyId)
            const queuePosition = assignment ? assignment.load + 1 : 1
            const transferReply = assignment
              ? `Entendi. Vou transferir seu atendimento para ${assignment.employee.name || assignment.employee.email || 'o próximo atendente disponível'}. Sua posição atual na fila é ${queuePosition}.`
              : `Entendi. No momento não há atendente livre. Seu atendimento entrou na fila humana com posição ${queuePosition}.`

            await addDoc(collection(db, 'messages'), {
              chatId: id,
              companyId: chat.companyId,
              content: transferReply,
              type: 'text',
              senderType: 'bot',
              senderId: 'bot',
              senderName: `${company.nomeFantasia || company.razaoSocial} BOT`,
              createdAt: serverTimestamp(),
              read: false,
            })
            await updateDoc(doc(db, 'chats', id), {
              status: 'waiting',
              botAwaitingResolvedConfirmation: false,
              employeeId: assignment?.employee?.userId || null,
              employeeName: assignment?.employee?.name || assignment?.employee?.email || null,
              queuePosition,
              lastMessage: transferReply,
              lastMessageAt: serverTimestamp(),
            })
            await rebalanceChatQueue(chat.companyId)
            await createAuditLog({
              companyId: chat.companyId,
              companyName: company?.nomeFantasia || company?.razaoSocial || chat.companyName,
              protocol: chat.protocolo,
              chatId: id,
              channel: 'chat',
              eventType: 'chat_transferred',
              clientId: user.uid,
              clientName: userData?.fullName || user.displayName || 'Cliente',
              employeeId: assignment?.employee?.userId || null,
              employeeName: assignment?.employee?.name || assignment?.employee?.email || null,
              summary: 'BOT transferiu o atendimento para a fila humana após falha na resolução.',
              metadata: { queuePosition },
            })
            return
          }
        }

        if ((chat as any).botAwaitingAnythingElse) {
          if (isAffirmative(text)) {
            const restartReply = 'Perfeito. Me diga qual é a nova necessidade e eu vou tentar resolver novamente antes de transferir.'
            await addDoc(collection(db, 'messages'), {
              chatId: id,
              companyId: chat.companyId,
              content: restartReply,
              type: 'text',
              senderType: 'bot',
              senderId: 'bot',
              senderName: `${company.nomeFantasia || company.razaoSocial} BOT`,
              createdAt: serverTimestamp(),
              read: false,
            })
            await updateDoc(doc(db, 'chats', id), {
              botAwaitingAnythingElse: false,
              botResolved: false,
              botAttempts: 0,
              lastMessage: restartReply,
              lastMessageAt: serverTimestamp(),
            })
            return
          }

          if (isNegative(text)) {
            const closeReply = 'Perfeito! Vou encerrar o atendimento e liberar o formulário de avaliação.'
            await addDoc(collection(db, 'messages'), {
              chatId: id,
              companyId: chat.companyId,
              content: closeReply,
              type: 'text',
              senderType: 'bot',
              senderId: 'bot',
              senderName: `${company.nomeFantasia || company.razaoSocial} BOT`,
              createdAt: serverTimestamp(),
              read: false,
            })
            await updateDoc(doc(db, 'chats', id), {
              status: 'closed',
              botAwaitingAnythingElse: false,
              botResolved: true,
              endedAt: serverTimestamp(),
              lastMessage: closeReply,
              lastMessageAt: serverTimestamp(),
            })
            return
          }
        }

        const localBotReply = resolveConfiguredReply(text, company)
        const currentAttempts = Number((chat as any).botAttempts || 0) + 1
        const botResponse = localBotReply || await fetch('/api/bot/respond', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            companyName: company.nomeFantasia || company.razaoSocial,
            botGreeting: company.botGreeting,
            botPolicies: company.botPolicies,
            botOutOfHours: company.botOutOfHours,
            botTransferKeywords: company.settings?.botTransferKeywords || [],
            intents: company.settings?.botIntents || [],
            uraScript: company.uraOptions?.map((option) => `${option.digit} - ${option.label}`).join('\n'),
            horarioInicio: company.horarioInicio,
            horarioFim: company.horarioFim,
            horarioAlmocoInicio: company.horarioAlmocoInicio,
            horarioAlmocoFim: company.horarioAlmocoFim,
            diasFuncionamento: company.diasFuncionamento,
            message: text,
          }),
        }).then((response) => response.json())

        const maxAttempts = Math.min(5, Math.max(1, Number(company.settings?.botMaxAttempts || 3)))
        const shouldTransferToHuman = Boolean(botResponse?.needsHuman) || currentAttempts >= maxAttempts || !botResponse?.reply

        if (!shouldTransferToHuman) {
          const answerReply = botResponse?.reply || 'Encontrei uma orientação inicial para o seu caso.'
          const followUp = company.settings?.botResolutionPrompt || 'Seu problema foi resolvido?'
          await addDoc(collection(db, 'messages'), {
            chatId: id,
            companyId: chat.companyId,
            content: answerReply,
            type: 'text',
            senderType: 'bot',
            senderId: 'bot',
            senderName: `${company.nomeFantasia || company.razaoSocial} BOT`,
            createdAt: serverTimestamp(),
            read: false,
          })
          await addDoc(collection(db, 'messages'), {
            chatId: id,
            companyId: chat.companyId,
            content: followUp,
            type: 'text',
            senderType: 'bot',
            senderId: 'bot',
            senderName: `${company.nomeFantasia || company.razaoSocial} BOT`,
            createdAt: serverTimestamp(),
            read: false,
          })

          await updateDoc(doc(db, 'chats', id), {
            status: 'bot',
            botResolved: false,
            botAttempts: currentAttempts,
            botAwaitingResolvedConfirmation: true,
            lastMessage: followUp,
            lastMessageAt: serverTimestamp(),
          })

          await createAuditLog({
            companyId: chat.companyId,
            companyName: company?.nomeFantasia || company?.razaoSocial || chat.companyName,
            protocol: chat.protocolo,
            chatId: id,
            channel: 'chat',
            eventType: 'chat_bot_reply',
            clientId: user.uid,
            clientName: userData?.fullName || user.displayName || 'Cliente',
            summary: 'BOT respondeu e confirmou se o problema foi resolvido.',
            metadata: { attempt: currentAttempts, answerReply },
          })

          return
        }

        const assignment = await assignLeastLoadedAttendant(chat.companyId)
        const queuePosition = assignment ? assignment.load + 1 : 1
        const transferReply = assignment
          ? `Perfeito. Vou te encaminhar para ${assignment.employee.name || assignment.employee.email || 'o próximo atendente disponível'}. Sua posição atual na fila é ${queuePosition}.`
          : `No momento não há atendente livre. Seu atendimento entrou na fila humana com posição ${queuePosition}.`

        await addDoc(collection(db, 'messages'), {
          chatId: id,
          companyId: chat.companyId,
          content: transferReply,
          type: 'text',
          senderType: 'bot',
          senderId: 'bot',
          senderName: `${company.nomeFantasia || company.razaoSocial} BOT`,
          createdAt: serverTimestamp(),
          read: false,
        })

        await updateDoc(doc(db, 'chats', id), {
          status: 'waiting',
          botResolved: false,
          employeeId: assignment?.employee?.userId || null,
          employeeName: assignment?.employee?.name || assignment?.employee?.email || null,
          queuePosition,
          lastMessage: transferReply,
          lastMessageAt: serverTimestamp(),
        })
        await rebalanceChatQueue(chat.companyId)

        await createNotification({
          recipientCompanyId: chat.companyId,
          recipientUserId: assignment?.employee?.userId,
          title: 'Cliente aguardando humano',
          body: `${userData?.fullName || user.displayName || 'Cliente'} foi direcionado para a fila humana no protocolo ${chat.protocolo}.`,
          type: 'chat',
          actionUrl: `/dashboard/chats?chat=${id}`,
          entityId: id,
          entityType: 'chat',
          actorName: userData?.fullName || user.displayName || 'Cliente',
        })

        await createAuditLog({
          companyId: chat.companyId,
          companyName: company?.nomeFantasia || company?.razaoSocial || chat.companyName,
          protocol: chat.protocolo,
          chatId: id,
          channel: 'chat',
          eventType: 'chat_transferred',
          clientId: user.uid,
          clientName: userData?.fullName || user.displayName || 'Cliente',
          employeeId: assignment?.employee?.userId || null,
          employeeName: assignment?.employee?.name || assignment?.employee?.email || null,
          summary: 'BOT encaminhou o atendimento para a fila humana.',
          metadata: { queuePosition, attempts: currentAttempts },
        })
      }
    } catch {
      toast.error('Erro ao enviar mensagem');
    } finally {
      setSending(false);
    }
  };

  const handleBotButtonClick = async (button: any) => {
    if (!user || !chat || !company) return
    setSending(true)

    try {
      await addDoc(collection(db, 'messages'), {
        chatId: id,
        companyId: chat.companyId,
        content: button.label,
        type: 'text',
        senderType: 'client',
        senderId: user.uid,
        senderName: userData?.fullName || user.displayName || 'Cliente',
        senderPhotoURL: user.photoURL || null,
        createdAt: serverTimestamp(),
        read: false,
      })

      await createAuditLog({
        companyId: chat.companyId,
        companyName: company?.nomeFantasia || company?.razaoSocial || chat.companyName,
        protocol: chat.protocolo,
        chatId: id,
        channel: 'chat',
        eventType: 'chat_message',
        clientId: user.uid,
        clientName: userData?.fullName || user.displayName || 'Cliente',
        summary: 'Cliente acionou um botão programado do BOT.',
        metadata: { buttonLabel: button.label, buttonAction: button.action || 'reply' },
      })

      if (button.action === 'queue' || button.action === 'transfer') {
        const assignment = await assignLeastLoadedAttendant(chat.companyId)
        const queuePosition = assignment ? assignment.load + 1 : 1
        const transferReply = assignment
          ? `Tudo certo. Vou colocar seu atendimento na fila humana com ${assignment.employee.name || assignment.employee.email || 'o próximo atendente disponível'}. Sua posição atual é ${queuePosition}.`
          : `Tudo certo. No momento não há atendente livre. Seu atendimento entrou na fila humana com posição ${queuePosition}.`

        await addDoc(collection(db, 'messages'), {
          chatId: id,
          companyId: chat.companyId,
          content: transferReply,
          type: 'text',
          senderType: 'bot',
          senderId: 'bot',
          senderName: `${company.nomeFantasia || company.razaoSocial} BOT`,
          createdAt: serverTimestamp(),
          read: false,
        })

        await updateDoc(doc(db, 'chats', id), {
          status: 'waiting',
          employeeId: assignment?.employee?.userId || null,
          employeeName: assignment?.employee?.name || assignment?.employee?.email || null,
          queuePosition,
          lastMessage: transferReply,
          lastMessageAt: serverTimestamp(),
          lastActivity: serverTimestamp(),
          botCurrentMessageId: null,
        })
        await rebalanceChatQueue(chat.companyId)
        await createNotification({
          recipientCompanyId: chat.companyId,
          recipientUserId: assignment?.employee?.userId,
          title: 'Cliente aguardando humano',
          body: `${userData?.fullName || user.displayName || 'Cliente'} entrou na fila humana pelo BOT no protocolo ${chat.protocolo}.`,
          type: 'chat',
          actionUrl: `/dashboard/chats?chat=${id}`,
          entityId: id,
          entityType: 'chat',
        })
      } else if (button.action === 'action') {
        const actionReply = button.actionLabel?.trim() || 'A ação configurada foi registrada com sucesso.'
        await addDoc(collection(db, 'messages'), {
          chatId: id,
          companyId: chat.companyId,
          content: actionReply,
          type: 'text',
          senderType: 'bot',
          senderId: 'bot',
          senderName: `${company.nomeFantasia || company.razaoSocial} BOT`,
          createdAt: serverTimestamp(),
          read: false,
        })
        await updateDoc(doc(db, 'chats', id), {
          status: 'bot',
          lastMessage: actionReply,
          lastMessageAt: serverTimestamp(),
          lastActivity: serverTimestamp(),
        })
      } else if (button.action === 'close') {
        const closeReply = 'Atendimento encerrado pelo fluxo configurado da empresa. Você poderá avaliar este protocolo agora.'
        await addDoc(collection(db, 'messages'), {
          chatId: id,
          companyId: chat.companyId,
          content: closeReply,
          type: 'text',
          senderType: 'bot',
          senderId: 'bot',
          senderName: `${company.nomeFantasia || company.razaoSocial} BOT`,
          createdAt: serverTimestamp(),
          read: false,
        })
        await updateDoc(doc(db, 'chats', id), {
          status: 'closed',
          botResolved: true,
          endedAt: serverTimestamp(),
          lastMessage: closeReply,
          lastMessageAt: serverTimestamp(),
          lastActivity: serverTimestamp(),
          botCurrentMessageId: null,
        })
      } else {
        const nextMessage = getChatFlowTargetMessage(company, button.targetMessageId)
        const followUp = nextMessage?.text || 'Tudo certo. Siga escolhendo uma das opções abaixo.'
        await addDoc(collection(db, 'messages'), {
          chatId: id,
          companyId: chat.companyId,
          content: followUp,
          type: 'text',
          senderType: 'bot',
          senderId: 'bot',
          senderName: `${company.nomeFantasia || company.razaoSocial} BOT`,
          createdAt: serverTimestamp(),
          read: false,
        })
        await updateDoc(doc(db, 'chats', id), {
          status: 'bot',
          botCurrentMessageId: nextMessage?.id || chat.botCurrentMessageId || null,
          botAwaitingResolvedConfirmation: false,
          botAwaitingAnythingElse: false,
          botResolved: false,
          lastMessage: followUp,
          lastMessageAt: serverTimestamp(),
          lastActivity: serverTimestamp(),
        })
      }
    } catch {
      toast.error('Não foi possível usar este botão do BOT agora.')
    } finally {
      setSending(false)
    }
  }

  const resolveClosure = async (resolved: boolean) => {
    if (!chat || !user) return

    try {
      if (resolved) {
        const followUp = 'Ótimo. Precisa de mais alguma coisa?'
        await addDoc(collection(db, 'messages'), {
          chatId: id,
          companyId: chat.companyId,
          content: followUp,
          type: 'text',
          senderType: 'bot',
          senderId: 'bot',
          senderName: `${company?.nomeFantasia || company?.razaoSocial || 'Empresa'} BOT`,
          createdAt: serverTimestamp(),
          read: false,
        })

        await updateDoc(doc(db, 'chats', id), {
          status: 'bot',
          botAwaitingAnythingElse: true,
          botResolved: true,
          queuePosition: null,
          lastMessage: followUp,
          lastMessageAt: serverTimestamp(),
        })
      } else {
        await addDoc(collection(db, 'messages'), {
          chatId: id,
          companyId: chat.companyId,
          content: 'Tudo bem. Vou reabrir seu atendimento para a equipe continuar ajudando.',
          type: 'text',
          senderType: 'bot',
          senderId: 'bot',
          senderName: `${company?.nomeFantasia || company?.razaoSocial || 'Empresa'} BOT`,
          createdAt: serverTimestamp(),
          read: false,
        })

        await updateDoc(doc(db, 'chats', id), {
          status: chat.employeeId ? 'active' : 'waiting',
          botAwaitingAnythingElse: false,
          botResolved: false,
        })
        await rebalanceChatQueue(chat.companyId)

        await createAuditLog({
          companyId: chat.companyId,
          companyName: company?.nomeFantasia || company?.razaoSocial || chat.companyName,
          protocol: chat.protocolo,
          chatId: id,
          channel: 'chat',
          eventType: 'chat_reopened',
          clientId: user.uid,
          clientName: userData?.fullName || user.displayName || 'Cliente',
          employeeId: chat.employeeId || null,
          employeeName: (chat as any).employeeName || null,
          summary: 'Cliente informou que o problema não foi resolvido após encerramento.',
        })
      }
    } catch {
      toast.error('Não foi possível registrar sua resposta agora.')
    }
  }

  const handleSubmitRating = async () => {
    if (!user || !chat || ratingSaved) return
    setSavingRating(true)
    try {
      await addDoc(collection(db, 'ratings'), {
        entityId: id,
        chatId: id,
        protocol: chat.protocolo,
        companyId: chat.companyId,
        companyName: company?.nomeFantasia || company?.razaoSocial || chat.companyName,
        employeeId: chat.employeeId || null,
        clientId: user.uid,
        clientName: userData?.fullName || user.displayName || 'Cliente',
        type: 'chat',
        rating,
        comment: ratingComment,
        botResolved: chat.botResolved || false,
        createdAt: serverTimestamp(),
      })

      await updateDoc(doc(db, 'chats', id), {
        rating,
        ratingComment,
        ratedAt: serverTimestamp(),
      })

      await createNotification({
        recipientCompanyId: chat.companyId,
        recipientUserId: chat.employeeId || undefined,
        title: 'Nova avaliação de chat',
        body: `${userData?.fullName || user.displayName || 'Cliente'} avaliou o protocolo ${chat.protocolo} com nota ${rating}.`,
        type: 'rating',
        actionUrl: '/dashboard/ratings',
        entityId: id,
        entityType: 'rating',
      })

      await createAuditLog({
        companyId: chat.companyId,
        companyName: company?.nomeFantasia || company?.razaoSocial || chat.companyName,
        protocol: chat.protocolo,
        chatId: id,
        channel: 'chat',
        eventType: 'chat_rating',
        clientId: user.uid,
        clientName: userData?.fullName || user.displayName || 'Cliente',
        employeeId: chat.employeeId || null,
        employeeName: (chat as any).employeeName || null,
        summary: 'Cliente enviou avaliação do atendimento.',
        metadata: { rating, comment: ratingComment },
      })

      setRatingSaved(true)
      toast.success('Avaliação enviada com sucesso.')
    } catch {
      toast.error('Não foi possível registrar sua avaliação agora.')
    } finally {
      setSavingRating(false)
    }
  }

  // Agrupar mensagens por data
  const groupedMessages = messages.reduce(
    (groups: { date: string; messages: Message[] }[], message) => {
      const date = message.createdAt ? message.createdAt.toLocaleDateString('pt-BR') : '';
      const lastGroup = groups[groups.length - 1];

      if (lastGroup && lastGroup.date === date) {
        lastGroup.messages.push(message);
      } else {
        groups.push({ date, messages: [message] });
      }

      return groups;
    },
    []
  );

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  if (!chat) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <Building2 className="w-16 h-16 text-muted-foreground/50 mb-4" />
        <h1 className="text-2xl font-bold mb-2">Conversa não encontrada</h1>
        <p className="text-muted-foreground mb-6">
          Esta conversa não existe ou foi removida
        </p>
        <Button onClick={() => router.push('/cliente')}>
          <ArrowLeft className="mr-2 w-4 h-4" />
          Voltar
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed inset-x-0 bottom-0 top-16 z-20 flex overflow-hidden bg-background lg:left-24">
      <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-background">
      {/* Header */}
      <header className="shrink-0 glass-strong border-b border-border">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={() => router.back()}
            className="p-2 -ml-2 rounded-lg hover:bg-secondary transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3 flex-1 min-w-0">
            {company?.logoURL ? (
              <img
                src={company.logoURL}
                alt={company.nomeFantasia}
                className="w-10 h-10 rounded-lg object-cover"
              />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-gradient-primary flex items-center justify-center">
                <Building2 className="w-5 h-5 text-primary-foreground" />
              </div>
            )}

            <div className="min-w-0">
              <h1 className="font-semibold truncate">
                {company?.nomeFantasia || company?.razaoSocial || chat.companyName}
              </h1>
              <p className="text-xs text-muted-foreground">
                {chat.status === 'waiting' && 'Fila humana em preparação'}
                {chat.status === 'active' && 'Em atendimento'}
                {chat.status === 'bot' && 'BOT atendendo primeiro'}
                {chat.status === 'closed' && 'Conversa encerrada'}
              </p>
            </div>
          </div>
        </div>
      </header>

      {chat.status === 'waiting' && typeof chat.queuePosition === 'number' ? (
        <div className="shrink-0 border-b border-border bg-primary/5 p-3 text-center text-sm text-primary" data-testid="client-chat-queue-banner">
          Sua posição na fila: {chat.queuePosition} • Pessoas na sua frente: {Math.max(0, Number(chat.queuePosition || 1) - 1)}
        </div>
      ) : null}

      {/* Messages */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 space-y-6">
        {groupedMessages.map((group, idx) => (
          <div key={idx} className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground px-2">{group.date}</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {group.messages.map(message => {
              const isClient = message.senderType === 'client';
              const isBot = message.senderType === 'bot';

              return (
                <div
                  key={message.id}
                  className={`flex items-end gap-2 ${isClient ? 'flex-row-reverse' : ''}`}
                >
                  {!isClient && (
                    <Avatar className="w-8 h-8 shrink-0">
                      {isBot ? (
                        <AvatarFallback className="bg-gradient-accent">
                          <Bot className="w-4 h-4 text-accent-foreground" />
                        </AvatarFallback>
                      ) : message.senderPhotoURL ? (
                        <AvatarImage src={message.senderPhotoURL} />
                      ) : (
                        <AvatarFallback className="bg-secondary">
                          <User className="w-4 h-4" />
                        </AvatarFallback>
                      )}
                    </Avatar>
                  )}

                  <div
                    className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                      isClient
                        ? 'bg-primary text-primary-foreground rounded-br-sm'
                        : isBot
                        ? 'bg-accent/20 text-foreground rounded-bl-sm'
                        : 'bg-secondary text-foreground rounded-bl-sm'
                    }`}
                  >
                    {!isClient && !isBot && (
                      <p className="text-xs font-medium mb-1 opacity-70">{message.senderName}</p>
                    )}
                    <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
                    {isClient && (
                      <div className="flex items-center gap-1 mt-1 justify-end">
                        <span className="text-[10px] opacity-60">
                          {formatTime(message.createdAt ?? new Date())}
                        </span>
                        {message.read ? (
                          <CheckCheck className="w-3 h-3 opacity-60" />
                        ) : (
                          <Check className="w-3 h-3 opacity-60" />
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      {chat.status !== 'closed' && chat.status !== 'pending_resolution' && (
        <div className="shrink-0 glass-strong border-t border-border p-4">
          {isStructuredBotFlow ? (
            <div className="mb-3 flex flex-wrap gap-2" data-testid="client-chat-bot-buttons">
              {botButtons.map((button: any, index: number) => (
                <Button key={`${button.label}-${index}`} type="button" variant="outline" onClick={() => handleBotButtonClick(button)} data-testid={`client-chat-bot-button-${index}`}>
                  {button.label}
                </Button>
              ))}
            </div>
          ) : null}
          <form
            onSubmit={e => {
              e.preventDefault();
              handleSend(newMessage);
            }}
            className="flex items-center gap-2"
          >
            <Button type="button" variant="ghost" size="icon" className="shrink-0 text-muted-foreground hover:text-foreground">
              <Paperclip className="w-5 h-5" />
            </Button>

            <Input
              ref={inputRef}
              placeholder={isStructuredBotFlow ? 'Use os botões do BOT para seguir o fluxo' : 'Digite sua mensagem...'}
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              className="flex-1 h-11 bg-secondary/50 border-border"
              disabled={sending || isStructuredBotFlow}
            />

            <Button
              type="submit"
              size="icon"
              disabled={!newMessage.trim() || sending || isStructuredBotFlow}
              className="shrink-0 bg-gradient-primary hover:opacity-90"
            >
              {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </Button>
          </form>
        </div>
      )}

      {(chat as any).botAwaitingResolvedConfirmation ? (
        <div className="shrink-0 border-t border-border bg-sky-500/5 p-4">
          <div className="mx-auto max-w-xl rounded-3xl border border-sky-500/20 bg-background/90 p-4 text-center">
            <p className="text-sm font-medium">Seu problema foi resolvido pelo BOT?</p>
            <div className="mt-4 flex flex-wrap justify-center gap-3">
              <Button onClick={() => handleSend('Sim')} data-testid="client-chat-bot-resolved-yes">Sim</Button>
              <Button variant="outline" onClick={() => handleSend('Não')} data-testid="client-chat-bot-resolved-no">Não</Button>
            </div>
          </div>
        </div>
      ) : null}

      {(chat as any).botAwaitingAnythingElse ? (
        <div className="shrink-0 border-t border-border bg-emerald-500/5 p-4">
          <div className="mx-auto max-w-xl rounded-3xl border border-emerald-500/20 bg-background/90 p-4 text-center">
            <p className="text-sm font-medium">Precisa de mais alguma coisa?</p>
            <div className="mt-4 flex flex-wrap justify-center gap-3">
              <Button onClick={() => handleSend('Sim')} data-testid="client-chat-anything-else-yes">Sim</Button>
              <Button variant="outline" onClick={() => handleSend('Não')} data-testid="client-chat-anything-else-no">Não</Button>
            </div>
          </div>
        </div>
      ) : null}

      {chat.status === 'pending_resolution' && (
        <div className="shrink-0 border-t border-border bg-amber-500/5 p-4">
          <div className="mx-auto max-w-xl rounded-3xl border border-amber-500/20 bg-background/90 p-4 text-center">
            <p className="text-sm font-medium">Seu problema foi resolvido?</p>
            <div className="mt-4 flex flex-wrap justify-center gap-3">
              <Button onClick={() => resolveClosure(true)} data-testid="client-chat-resolution-yes">Sim, resolveu</Button>
              <Button variant="outline" onClick={() => resolveClosure(false)} data-testid="client-chat-resolution-no">Não, continuar atendimento</Button>
            </div>
          </div>
        </div>
      )}

      {chat.status === 'closed' && (
        <div className="shrink-0 p-4 text-center bg-secondary/50 border-t border-border">
          <p className="text-sm text-muted-foreground">Esta conversa foi encerrada</p>
          {chat.botResolved ? <p className="mt-1 text-xs text-primary">Resolvido pelo BOT da empresa</p> : null}
          {!ratingSaved ? (
            <div className="mx-auto mt-4 max-w-xl rounded-3xl border border-border bg-background/80 p-4 text-left">
              <p className="mb-3 text-sm font-medium">Avalie este atendimento</p>
              <div className="mb-4 flex flex-wrap gap-2">
                {[1, 2, 3, 4, 5].map((value) => (
                  <Button key={value} type="button" variant={rating >= value ? 'default' : 'outline'} onClick={() => setRating(value)} data-testid={`client-chat-rating-${value}`}>
                    {value}★
                  </Button>
                ))}
              </div>
              <Textarea value={ratingComment} onChange={(event) => setRatingComment(event.target.value)} placeholder="Descreva sua experiência com a empresa, gerente ou atendente" data-testid="client-chat-rating-comment" />
              <Button onClick={handleSubmitRating} disabled={savingRating} className="mt-3" data-testid="client-chat-rating-submit">
                {savingRating ? 'Enviando...' : 'Enviar avaliação'}
              </Button>
            </div>
          ) : (
            <p className="mt-3 text-xs text-emerald-500">Sua avaliação já foi registrada.</p>
          )}
          <Button
            variant="link"
            onClick={() => router.push(`/empresa/${chat.companyId}`)}
            className="text-primary"
          >
            Iniciar nova conversa
          </Button>
        </div>
      )}
      </div>
    </div>
  );
}