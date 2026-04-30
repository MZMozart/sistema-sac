import { NextRequest, NextResponse } from 'next/server'

type BotPayload = {
  companyName?: string
  botGreeting?: string
  botPolicies?: string
  botOutOfHours?: string
  botTransferKeywords?: string[]
  intents?: Array<{ name?: string; examples?: string[]; responses?: string[] }>
  horarioInicio?: string
  horarioFim?: string
  horarioAlmocoInicio?: string
  horarioAlmocoFim?: string
  diasFuncionamento?: number[]
  message?: string
}

function parseMinutes(value?: string) {
  if (!value || !value.includes(':')) return null
  const [hour, minute] = value.split(':').map(Number)
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null
  return hour * 60 + minute
}

function isWithinBusinessHours(payload: Required<Pick<BotPayload, 'horarioInicio' | 'horarioFim'>> & BotPayload) {
  const now = new Date()
  const currentDay = now.getDay()
  const workingDays = payload.diasFuncionamento?.length ? payload.diasFuncionamento : [1, 2, 3, 4, 5]
  if (!workingDays.includes(currentDay)) return false

  const currentMinutes = now.getHours() * 60 + now.getMinutes()
  const start = parseMinutes(payload.horarioInicio)
  const end = parseMinutes(payload.horarioFim)
  const lunchStart = parseMinutes(payload.horarioAlmocoInicio)
  const lunchEnd = parseMinutes(payload.horarioAlmocoFim)

  if (start !== null && end !== null && (currentMinutes < start || currentMinutes > end)) return false
  if (lunchStart !== null && lunchEnd !== null && currentMinutes >= lunchStart && currentMinutes <= lunchEnd) return false

  return true
}

function buildHeuristicReply(payload: BotPayload) {
  const companyName = payload.companyName || 'sua empresa'
  const message = (payload.message || '').toLowerCase()
  const matchedIntent = payload.intents?.find((intent) =>
    intent.examples?.some((example) => message.includes(example.toLowerCase()))
  )
  const outsideHours = !isWithinBusinessHours({
    ...payload,
    horarioInicio: payload.horarioInicio || '08:00',
    horarioFim: payload.horarioFim || '18:00',
  })

  if (outsideHours) {
    return {
      provider: 'bot-fallback',
      reply:
        payload.botOutOfHours ||
        `${companyName}: nosso time humano está fora do horário de atendimento no momento. Posso adiantar orientações com base nas políticas cadastradas e deixar sua solicitação pronta para a próxima janela disponível.`,
      resolved: false,
      needsHuman: false,
      outsideHours: true,
    }
  }

  if (matchedIntent?.responses?.length) {
    return {
      provider: 'bot-intent',
      reply: matchedIntent.responses[0],
      resolved: false,
      needsHuman: false,
      outsideHours: false,
    }
  }

  const customTransferRegex = payload.botTransferKeywords?.length
    ? new RegExp(payload.botTransferKeywords.join('|'), 'i')
    : null

  if (customTransferRegex?.test(message)) {
    return {
      provider: 'bot-fallback',
      reply: `${companyName}: identifiquei a palavra-chave configurada para transferência e vou priorizar sua conversa para um atendente humano.`,
      resolved: false,
      needsHuman: true,
      outsideHours: false,
    }
  }

  if (/(humano|atendente|pessoa|especialista|supervisor|ligar)/.test(message)) {
    return {
      provider: 'bot-fallback',
      reply: `${companyName}: entendi que você quer atendimento humano. Vou deixar sua conversa sinalizada para a fila do atendente com menor carga e registrar o contexto para agilizar o próximo passo.`,
      resolved: false,
      needsHuman: true,
      outsideHours: false,
    }
  }

  if (/(pedido|entrega|prazo|rastreamento)/.test(message)) {
    return {
      provider: 'bot-fallback',
      reply: `${companyName}: posso ajudar com prazo, rastreamento e status do atendimento. Se você me informar o número do pedido ou protocolo, eu preparo a próxima ação de forma mais precisa.`,
      resolved: false,
      needsHuman: false,
      outsideHours: false,
    }
  }

  if (/(cobran|pagamento|fatura|financeiro|boleto)/.test(message)) {
    return {
      provider: 'bot-fallback',
      reply: `${companyName}: identifiquei um assunto financeiro. Posso registrar cobrança, pagamento ou fatura e, se necessário, encaminhar para a fila financeira da empresa.`,
      resolved: false,
      needsHuman: true,
      outsideHours: false,
    }
  }

  return {
    provider: 'bot-fallback',
    reply:
      payload.botGreeting ||
      `${companyName}: recebi sua mensagem e vou seguir as políticas configuradas para orientar o próximo passo. Se o caso exigir validação manual, eu direciono para um atendente humano.`,
    resolved: false,
    needsHuman: false,
    outsideHours: false,
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json().catch(() => ({}))) as BotPayload

    if (!payload.message) {
      return NextResponse.json({ error: 'invalid-payload' }, { status: 400 })
    }

    return NextResponse.json(buildHeuristicReply(payload))
  } catch (error) {
    console.error('bot respond failed', error)
    return NextResponse.json(buildHeuristicReply({ companyName: 'Empresa', message: 'Olá' }))
  }
}