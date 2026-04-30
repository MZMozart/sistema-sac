import asyncio
import json
import os
import sys
from emergentintegrations.llm.openai import OpenAITextToSpeech


async def main():
    payload = json.loads(sys.stdin.read() or '{}')
    text = payload.get('text', '')
    voice = payload.get('voice', 'alloy')
    speed = float(payload.get('speed', 1.0))
    model = payload.get('model', 'tts-1')
    response_format = payload.get('response_format', 'mp3')

    api_key = os.getenv('EMERGENT_LLM_KEY') or os.getenv('OPENAI_API_KEY')
    if not api_key:
        raise RuntimeError('missing-openai-or-emergent-key')

    tts = OpenAITextToSpeech(api_key=api_key)
    audio_bytes = await tts.generate_speech(
        text=text,
        model=model,
        voice=voice,
        speed=speed,
        response_format=response_format,
    )

    sys.stdout.buffer.write(audio_bytes)


if __name__ == '__main__':
    asyncio.run(main())