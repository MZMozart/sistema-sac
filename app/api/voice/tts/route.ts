import { NextRequest, NextResponse } from 'next/server'

const OPENAI_SPEECH_URL = 'https://api.openai.com/v1/audio/speech'

function splitSpeechText(text: string) {
  const chunks: string[] = []
  let current = ''
  text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .forEach((sentence) => {
      if ((current + ' ' + sentence).trim().length <= 180) {
        current = (current + ' ' + sentence).trim()
        return
      }
      if (current) chunks.push(current)
      if (sentence.length <= 180) {
        current = sentence
        return
      }
      for (let index = 0; index < sentence.length; index += 180) {
        chunks.push(sentence.slice(index, index + 180))
      }
      current = ''
    })
  if (current) chunks.push(current)
  return chunks.slice(0, 12)
}

async function generateFreePortugueseSpeech(text: string) {
  const chunks = splitSpeechText(text)
  const buffers: Buffer[] = []

  for (const chunk of chunks) {
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=pt-BR&q=${encodeURIComponent(chunk)}`
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        Accept: 'audio/mpeg,audio/*;q=0.9,*/*;q=0.8',
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      throw new Error(`free-tts-failed-${response.status}`)
    }

    buffers.push(Buffer.from(await response.arrayBuffer()))
  }

  return Buffer.concat(buffers)
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const text = String(body.text || '').trim()

    if (!text) {
      return NextResponse.json({ error: 'missing-text' }, { status: 400 })
    }

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      const freeAudioBuffer = await generateFreePortugueseSpeech(text)
      return new NextResponse(freeAudioBuffer, {
        headers: {
          'Content-Type': 'audio/mpeg',
          'Cache-Control': 'no-store',
        },
      })
    }

    const payload = JSON.stringify({
      input: text.slice(0, 4096),
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
      console.error('Falha no provedor TTS:', detail || response.statusText)
      const freeAudioBuffer = await generateFreePortugueseSpeech(text)
      return new NextResponse(freeAudioBuffer, {
        headers: {
          'Content-Type': 'audio/mpeg',
          'Cache-Control': 'no-store',
        },
      })
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
    console.error('Falha ao gerar voz da ligação:', message)
    const status = message.includes('insufficient_quota') ? 402 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
