#!/usr/bin/env python3
"""Check OpenAI Realtime connectivity without opening the microphone."""

from __future__ import annotations

import asyncio
import json
import os

import websockets
from dotenv import load_dotenv

from agent import DEFAULT_MODEL, DEFAULT_VOICE, ROOT, build_session_update, build_welcome_response


async def main() -> None:
    load_dotenv(ROOT / ".env")
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is missing")

    model = os.getenv("OPENAI_REALTIME_MODEL", DEFAULT_MODEL)
    voice = os.getenv("OPENAI_REALTIME_VOICE", DEFAULT_VOICE)
    uri = f"wss://api.openai.com/v1/realtime?model={model}"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "OpenAI-Beta": "realtime=v1",
    }

    async with websockets.connect(uri, additional_headers=headers) as websocket:
        first_event = json.loads(await asyncio.wait_for(websocket.recv(), timeout=10))
        if first_event.get("type") != "session.created":
            raise RuntimeError(f"Expected session.created, got {first_event.get('type')}")

        await websocket.send(json.dumps(build_session_update(model=model, voice=voice)))

        while True:
            event = json.loads(await asyncio.wait_for(websocket.recv(), timeout=10))
            if event.get("type") == "session.updated":
                await websocket.send(json.dumps(build_welcome_response()))
                break
            if event.get("type") == "error":
                raise RuntimeError(json.dumps(event, ensure_ascii=False))

        while True:
            event = json.loads(await asyncio.wait_for(websocket.recv(), timeout=20))
            if event.get("type") == "response.done":
                print("Realtime response ok")
                print(f"model={model}")
                print(f"voice={voice}")
                return
            if event.get("type") == "error":
                raise RuntimeError(json.dumps(event, ensure_ascii=False))


if __name__ == "__main__":
    asyncio.run(main())
