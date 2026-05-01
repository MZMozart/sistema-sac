import { NextRequest, NextResponse } from 'next/server'

const OPENAI_SPEECH_URL = 'https://api.openai.com/v1/audio/speech'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const text = String(body.text || '').trim()

    if (!text) {
      return NextResponse.json({ error: 'missing-text' }, { status: 400 })
    }

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'missing-openai-key' }, { status: 500 })
    }

    const payload = JSON.stringify({
      text: text.slice(0, 4096),
      voice: body.voice || 'alloy',
      speed: body.speed || 1,
      model: body.model || 'tts-1',
      response_format: 'mp3',
    })

    const response = await fetch(OPENAI_SPEECH_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: payload,
    })

    if (!response.ok) {
      const detail = await response.text()
      return NextResponse.json({ error: detail || 'tts-provider-failed' }, { status: response.status })
    }

    const audioBuffer = Buffer.from(await response.arrayBuffer())

    return new NextResponse(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-store',
      },
    })
  } catch (error: any) {
    const message = String(error?.message || 'tts-failed')
    const status = message.includes('insufficient_quota') ? 402 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
