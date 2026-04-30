export type ChatFlowButtonAction = 'goto' | 'queue' | 'action' | 'close'
export type CallDigitAction = 'info' | 'transfer' | 'action' | 'end' | 'goto'

export type ChatFlowButton = {
  id: string
  label: string
  action: ChatFlowButtonAction
  targetMessageId?: string | null
  actionLabel?: string | null
}

export type ChatFlowMessage = {
  id: string
  title: string
  text: string
  buttons: ChatFlowButton[]
}

export type CallDigitConfig = {
  digit: string
  label: string
  speech: string
  action: CallDigitAction
  targetDigit?: string | null
  actionLabel?: string | null
}

export function createEmptyChatButton(): ChatFlowButton {
  return {
    id: crypto.randomUUID(),
    label: 'Novo botão',
    action: 'goto',
    targetMessageId: null,
    actionLabel: null,
  }
}

export function createEmptyChatMessage(index = 1): ChatFlowMessage {
  return {
    id: crypto.randomUUID(),
    title: `Mensagem ${index}`,
    text: 'Olá! Como posso ajudar?',
    buttons: [createEmptyChatButton()],
  }
}

export function createDefaultCallDigits(): CallDigitConfig[] {
  return ['1','2','3','4','5','6','7','8','9','0'].map((digit) => ({
    digit,
    label: `Opção ${digit}`,
    speech: `Para a opção ${digit}, pressione ${digit}.`,
    action: digit === '0' ? 'transfer' : 'info',
    targetDigit: null,
    actionLabel: null,
  }))
}

export function parseChatFlow(raw: any): ChatFlowMessage[] {
  if (!Array.isArray(raw) || raw.length === 0) return [createEmptyChatMessage(1)]

  return raw.map((message: any, index: number) => ({
    id: message?.id || crypto.randomUUID(),
    title: message?.title || `Mensagem ${index + 1}`,
    text: message?.text || '',
    buttons: Array.isArray(message?.buttons) && message.buttons.length > 0
      ? message.buttons.map((button: any) => ({
          id: button?.id || crypto.randomUUID(),
          label: button?.label || 'Botão',
          action: ['goto', 'queue', 'action', 'close'].includes(button?.action) ? button.action : 'goto',
          targetMessageId: button?.targetMessageId || null,
          actionLabel: button?.actionLabel || null,
        }))
      : [createEmptyChatButton()],
  }))
}

export function parseCallDigits(raw: any): CallDigitConfig[] {
  const defaults = createDefaultCallDigits()
  if (!Array.isArray(raw) || raw.length === 0) return defaults

  return defaults.map((fallback) => {
    const found = raw.find((item: any) => String(item?.digit) === fallback.digit)
    return {
      digit: fallback.digit,
      label: found?.label || fallback.label,
      speech: found?.speech || found?.description || fallback.speech,
      action: ['info', 'transfer', 'action', 'end', 'goto'].includes(found?.action) ? found.action : fallback.action,
      targetDigit: found?.targetDigit || null,
      actionLabel: found?.actionLabel || null,
    }
  })
}

export function getInitialChatFlowMessage(company: any) {
  if (!Array.isArray(company?.settings?.chatBotFlowMessages) || company.settings.chatBotFlowMessages.length === 0) {
    return null
  }
  const flow = parseChatFlow(company?.settings?.chatBotFlowMessages)
  return flow[0] || null
}

export function getChatFlowButtons(company: any, chat: any): ChatFlowButton[] {
  if (!Array.isArray(company?.settings?.chatBotFlowMessages) || company.settings.chatBotFlowMessages.length === 0) {
    return []
  }
  const flow = parseChatFlow(company?.settings?.chatBotFlowMessages)
  const currentId = chat?.botCurrentMessageId || flow[0]?.id
  const current = flow.find((message) => message.id === currentId) || flow[0]
  return current?.buttons || []
}

export function getChatFlowTargetMessage(company: any, targetMessageId?: string | null) {
  if (!Array.isArray(company?.settings?.chatBotFlowMessages) || company.settings.chatBotFlowMessages.length === 0) {
    return null
  }
  const flow = parseChatFlow(company?.settings?.chatBotFlowMessages)
  return flow.find((message) => message.id === targetMessageId) || null
}