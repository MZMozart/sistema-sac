'use client'

import { useEffect, useMemo, useState } from 'react'
import { doc, updateDoc } from 'firebase/firestore'
import { useAuth } from '@/contexts/auth-context'
import { db } from '@/lib/firebase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { createDefaultCallDigits, createEmptyChatButton, createEmptyChatMessage, parseCallDigits, parseChatFlow, type CallDigitConfig, type ChatFlowButton, type ChatFlowMessage } from '@/lib/bot-flow'
import { ArrowDown, ArrowUp, GripVertical, Loader2, Plus, Save, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

type BotSection = 'chat' | 'call'

export default function BotPage() {
  const { company } = useAuth()
  const [activeSection, setActiveSection] = useState<BotSection>('chat')
  const [saving, setSaving] = useState(false)
  const [botName, setBotName] = useState('AtendePro BOT')
  const [chatMessages, setChatMessages] = useState<ChatFlowMessage[]>([createEmptyChatMessage(1)])
  const [callDigits, setCallDigits] = useState<CallDigitConfig[]>(createDefaultCallDigits())
  const [callIntroText, setCallIntroText] = useState('Bem-vindo. Escolha uma das opções do menu para continuar o atendimento.')
  const [draggedMessageId, setDraggedMessageId] = useState<string | null>(null)

  useEffect(() => {
    if (!company) return
    setBotName(company.botName || 'AtendePro BOT')
    setChatMessages(parseChatFlow(company.settings?.chatBotFlowMessages))
    setCallDigits(parseCallDigits(company.settings?.callBotOptions))
    setCallIntroText(company.settings?.callBotGreeting || 'Bem-vindo. Escolha uma das opções do menu para continuar o atendimento.')
  }, [company])

  const messageOptions = useMemo(() => chatMessages.map((message) => ({ id: message.id, title: message.title || 'Mensagem' })), [chatMessages])

  const updateMessage = (messageId: string, field: 'title' | 'text', value: string) => {
    setChatMessages((current) => current.map((message) => message.id === messageId ? { ...message, [field]: value } : message))
  }

  const addMessage = () => {
    setChatMessages((current) => [...current, createEmptyChatMessage(current.length + 1)])
  }

  const reorderMessages = (fromId: string, toId: string) => {
    setChatMessages((current) => {
      const fromIndex = current.findIndex((message) => message.id === fromId)
      const toIndex = current.findIndex((message) => message.id === toId)
      if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return current
      const clone = [...current]
      const [moved] = clone.splice(fromIndex, 1)
      clone.splice(toIndex, 0, moved)
      return clone
    })
  }

  const moveMessage = (messageId: string, direction: 'up' | 'down') => {
    setChatMessages((current) => {
      const index = current.findIndex((message) => message.id === messageId)
      if (index < 0) return current
      const targetIndex = direction === 'up' ? index - 1 : index + 1
      if (targetIndex < 0 || targetIndex >= current.length) return current
      const clone = [...current]
      const [item] = clone.splice(index, 1)
      clone.splice(targetIndex, 0, item)
      return clone
    })
  }

  const removeMessage = (messageId: string) => {
    setChatMessages((current) => {
      const filtered = current.filter((message) => message.id !== messageId)
      if (filtered.length === 0) return [createEmptyChatMessage(1)]
      return filtered.map((message) => ({
        ...message,
        buttons: message.buttons.map((button) => button.targetMessageId === messageId ? { ...button, targetMessageId: null } : button),
      }))
    })
  }

  const addButtonToMessage = (messageId: string) => {
    setChatMessages((current) => current.map((message) => message.id === messageId ? { ...message, buttons: [...message.buttons, createEmptyChatButton()] } : message))
  }

  const updateButton = (messageId: string, buttonId: string, field: keyof ChatFlowButton, value: string) => {
    setChatMessages((current) => current.map((message) => {
      if (message.id !== messageId) return message
      return {
        ...message,
        buttons: message.buttons.map((button) => button.id === buttonId ? { ...button, [field]: value } : button),
      }
    }))
  }

  const removeButton = (messageId: string, buttonId: string) => {
    setChatMessages((current) => current.map((message) => {
      if (message.id !== messageId) return message
      return {
        ...message,
        buttons: message.buttons.length === 1 ? [createEmptyChatButton()] : message.buttons.filter((button) => button.id !== buttonId),
      }
    }))
  }

  const updateCallDigit = (digit: string, field: keyof CallDigitConfig, value: string) => {
    setCallDigits((current) => current.map((item) => item.digit === digit ? { ...item, [field]: value } : item))
  }

  const handleSave = async () => {
    if (!company?.id) return
    setSaving(true)
    try {
      const persistedChat = chatMessages.map((message) => ({
        id: message.id,
        title: message.title.trim() || 'Mensagem',
        text: message.text.trim(),
        buttons: message.buttons.map((button) => ({
          id: button.id,
          label: button.label.trim(),
          action: button.action,
          targetMessageId: button.targetMessageId || null,
          actionLabel: button.actionLabel || null,
        })).filter((button) => button.label),
      })).filter((message) => message.text)

      await updateDoc(doc(db, 'companies', company.id), {
        botName,
        botGreeting: persistedChat[0]?.text || 'Olá! Como posso ajudar?',
        settings: {
          ...(company.settings || {}),
          chatBotFlowMessages: persistedChat,
          callBotGreeting: callIntroText,
          callBotOptions: callDigits,
        },
      })

      toast.success('Configuração do BOT salva com sucesso.')
    } catch {
      toast.error('Não foi possível salvar a configuração do BOT.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6" data-testid="dashboard-bot-page">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">Configuração do BOT</h1>
          <p className="mt-1 text-sm text-muted-foreground">A empresa controla o fluxo do chat e da ligação com mensagens, botões, números e ações.</p>
        </div>
        <Button onClick={handleSave} disabled={saving} className="bg-gradient-primary" data-testid="bot-save-button">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Salvar configuração
        </Button>
      </div>

      <Card className="glass border-border/80">
        <CardHeader>
          <CardTitle>Nome do BOT</CardTitle>
          <CardDescription>Nome exibido para cliente no chat e na ligação.</CardDescription>
        </CardHeader>
        <CardContent>
          <Input value={botName} onChange={(event) => setBotName(event.target.value)} data-testid="bot-name-input" />
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button variant={activeSection === 'chat' ? 'default' : 'outline'} onClick={() => setActiveSection('chat')} data-testid="bot-open-chat-config-button">
          Configuração de Chat
        </Button>
        <Button variant={activeSection === 'call' ? 'default' : 'outline'} onClick={() => setActiveSection('call')} data-testid="bot-open-call-config-button">
          Configuração de Ligação
        </Button>
      </div>

      {activeSection === 'chat' ? (
        <div className="space-y-4" data-testid="bot-chat-config-panel">
          <Card className="glass border-border/80">
            <CardHeader>
              <CardTitle>Saudação inicial</CardTitle>
              <CardDescription>É a primeira mensagem enviada assim que o cliente entra em um chat novo.</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={chatMessages[0]?.text || ''}
                onChange={(event) => updateMessage(chatMessages[0]?.id || '', 'text', event.target.value)}
                className="min-h-[120px]"
                data-testid="bot-chat-greeting-input"
              />
            </CardContent>
          </Card>

          <div className="flex flex-wrap gap-3">
            <Button onClick={addMessage} data-testid="bot-add-message-button">
              <Plus className="mr-2 h-4 w-4" />
              Criar nova mensagem
            </Button>
          </div>

          {chatMessages.map((message, messageIndex) => (
            <Card
              key={message.id}
              draggable
              onDragStart={() => setDraggedMessageId(message.id)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => {
                if (draggedMessageId) reorderMessages(draggedMessageId, message.id)
                setDraggedMessageId(null)
              }}
              className="glass border-border/80"
              data-testid={`bot-chat-message-card-${message.id}`}
            >
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle>{messageIndex === 0 ? 'Mensagem inicial' : `Mensagem ${messageIndex + 1}`}</CardTitle>
                    <CardDescription>Crie a mensagem, adicione botões e defina a ação de cada botão.</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <GripVertical className="h-5 w-5 text-muted-foreground" />
                    <Button variant="ghost" size="sm" onClick={() => moveMessage(message.id, 'up')} data-testid={`bot-move-message-up-${message.id}`}><ArrowUp className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => moveMessage(message.id, 'down')} data-testid={`bot-move-message-down-${message.id}`}><ArrowDown className="h-4 w-4" /></Button>
                    {messageIndex > 0 ? (
                      <Button variant="ghost" size="icon" onClick={() => removeMessage(message.id)} data-testid={`bot-remove-message-${message.id}`}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    ) : null}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Título interno</Label>
                  <Input value={message.title} onChange={(event) => updateMessage(message.id, 'title', event.target.value)} data-testid={`bot-message-title-${message.id}`} />
                </div>
                <div className="space-y-2">
                  <Label>Mensagem do BOT</Label>
                  <Textarea value={message.text} onChange={(event) => updateMessage(message.id, 'text', event.target.value)} className="min-h-[120px]" data-testid={`bot-message-text-${message.id}`} />
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button type="button" variant="outline" onClick={() => addButtonToMessage(message.id)} data-testid={`bot-add-button-${message.id}`}>
                    <Plus className="mr-2 h-4 w-4" />
                    Adicionar botão
                  </Button>
                  <Button type="button" variant="outline" onClick={() => addButtonToMessage(message.id)} data-testid={`bot-add-action-${message.id}`}>
                    <Plus className="mr-2 h-4 w-4" />
                    Adicionar ação
                  </Button>
                </div>

                <div className="space-y-3">
                  {message.buttons.map((button, buttonIndex) => (
                    <div key={button.id} className="rounded-2xl border border-border bg-card/60 p-4" data-testid={`bot-button-card-${button.id}`}>
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <p className="font-medium">Botão {buttonIndex + 1}</p>
                        <Button variant="ghost" size="icon" onClick={() => removeButton(message.id, button.id)} data-testid={`bot-remove-button-${button.id}`}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <div className="space-y-2">
                          <Label>Texto do botão</Label>
                          <Input value={button.label} onChange={(event) => updateButton(message.id, button.id, 'label', event.target.value)} data-testid={`bot-button-label-${button.id}`} />
                        </div>
                        <div className="space-y-2">
                          <Label>Ação do botão</Label>
                          <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={button.action} onChange={(event) => updateButton(message.id, button.id, 'action', event.target.value)} data-testid={`bot-button-action-${button.id}`}>
                            <option value="goto">Ir para outra mensagem</option>
                            <option value="queue">Enviar para fila</option>
                            <option value="action">Executar ação específica</option>
                            <option value="close">Encerrar fluxo</option>
                          </select>
                        </div>
                        <div className="space-y-2">
                          <Label>Destino da mensagem</Label>
                          <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={button.targetMessageId || ''} onChange={(event) => updateButton(message.id, button.id, 'targetMessageId', event.target.value)} data-testid={`bot-button-target-${button.id}`}>
                            <option value="">Sem destino</option>
                            {messageOptions.filter((item) => item.id !== message.id).map((target) => (
                              <option key={target.id} value={target.id}>{target.title}</option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-2">
                          <Label>Ação específica</Label>
                          <Input value={button.actionLabel || ''} onChange={(event) => updateButton(message.id, button.id, 'actionLabel', event.target.value)} placeholder="Ex: registrar entrega" data-testid={`bot-button-action-label-${button.id}`} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-4" data-testid="bot-call-config-panel">
          <Card className="glass border-border/80">
            <CardHeader>
              <CardTitle>Mensagem inicial da ligação</CardTitle>
              <CardDescription>Texto que será falado antes do cliente digitar um número.</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea value={callIntroText} onChange={(event) => setCallIntroText(event.target.value)} className="min-h-[120px]" data-testid="bot-call-intro-input" />
            </CardContent>
          </Card>

          <Card className="glass border-border/80">
            <CardHeader>
              <CardTitle>Teclado da ligação</CardTitle>
              <CardDescription>Para cada número de 0 a 9, defina a mensagem falada e a ação correspondente.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {callDigits.map((digit) => (
                <div key={digit.digit} className="rounded-2xl border border-border bg-card/60 p-4" data-testid={`bot-call-digit-card-${digit.digit}`}>
                  <p className="mb-3 text-lg font-bold">Tecla {digit.digit}</p>
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label>Título</Label>
                      <Input value={digit.label} onChange={(event) => updateCallDigit(digit.digit, 'label', event.target.value)} data-testid={`bot-call-digit-label-${digit.digit}`} />
                    </div>
                    <div className="space-y-2">
                      <Label>Mensagem falada</Label>
                      <Textarea value={digit.speech} onChange={(event) => updateCallDigit(digit.digit, 'speech', event.target.value)} className="min-h-[100px]" data-testid={`bot-call-digit-speech-${digit.digit}`} />
                    </div>
                    <div className="space-y-2">
                      <Label>Ação</Label>
                      <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={digit.action} onChange={(event) => updateCallDigit(digit.digit, 'action', event.target.value)} data-testid={`bot-call-digit-action-${digit.digit}`}>
                        <option value="info">Ler informação</option>
                        <option value="goto">Ir para outro número</option>
                        <option value="transfer">Enviar para fila</option>
                        <option value="action">Executar ação específica</option>
                        <option value="end">Encerrar ligação</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>Ir para o número</Label>
                      <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={digit.targetDigit || ''} onChange={(event) => updateCallDigit(digit.digit, 'targetDigit', event.target.value)} data-testid={`bot-call-digit-target-${digit.digit}`}>
                        <option value="">Sem destino</option>
                        {callDigits.filter((item) => item.digit !== digit.digit).map((item) => (
                          <option key={item.digit} value={item.digit}>{item.digit} - {item.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>Ação específica</Label>
                      <Input value={digit.actionLabel || ''} onChange={(event) => updateCallDigit(digit.digit, 'actionLabel', event.target.value)} placeholder="Ex: encaminhar para setor financeiro" data-testid={`bot-call-digit-action-label-${digit.digit}`} />
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}