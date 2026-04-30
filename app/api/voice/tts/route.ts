import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const text = String(body.text || '').trim()

    if (!text) {
      return NextResponse.json({ error: 'missing-text' }, { status: 400 })
    }

    const payload = JSON.stringify({
      text: text.slice(0, 4096),
      voice: body.voice || 'alloy',
      speed: body.speed || 1,
      model: body.model || 'tts-1',
      response_format: 'mp3',
    })

    const audioBuffer = await new Promise<Buffer>((resolve, reject) => {
      const child = spawn('/root/.venv/bin/python', ['/app/scripts/generate_tts.py'], {
        env: process.env,
      })

      const chunks: Buffer[] = []
      const errorChunks: Buffer[] = []

      child.stdout.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
      child.stderr.on('data', (chunk) => errorChunks.push(Buffer.from(chunk)))
      child.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(Buffer.concat(errorChunks).toString() || 'tts-process-failed'))
          return
        }
        resolve(Buffer.concat(chunks))
      })

      child.stdin.write(payload)
      child.stdin.end()
    })

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