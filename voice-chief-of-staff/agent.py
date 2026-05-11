#!/usr/bin/env python3
"""Realtime voice Chief of Staff agent.

Streams microphone audio to OpenAI Realtime over WebSocket and plays the
assistant's PCM audio response as it arrives.
"""

from __future__ import annotations

import argparse
import asyncio
import base64
import json
import os
import signal
from pathlib import Path
from typing import Any

import sounddevice as sd
import websockets
from dotenv import load_dotenv


ROOT = Path(__file__).resolve().parent
SAMPLE_RATE = 24_000
CHANNELS = 1
DTYPE = "int16"
CHUNK_MS = 40
BLOCKSIZE = SAMPLE_RATE * CHUNK_MS // 1000
DEFAULT_MODEL = "gpt-realtime"
DEFAULT_VOICE = "marin"


def load_instructions() -> str:
    prompt = (ROOT / "chief_of_staff_prompt.txt").read_text(encoding="utf-8").strip()
    memory_path = ROOT / "memory.md"
    memory = memory_path.read_text(encoding="utf-8").strip() if memory_path.exists() else ""
    if memory:
        return f"{prompt}\n\nContexte persistant fourni par l'utilisateur :\n{memory}"
    return prompt


def build_session_update(model: str, voice: str) -> dict[str, Any]:
    return {
        "type": "session.update",
        "session": {
            "modalities": ["audio", "text"],
            "instructions": load_instructions(),
            "voice": voice,
            "input_audio_format": "pcm16",
            "output_audio_format": "pcm16",
            "turn_detection": {
                "type": "semantic_vad",
                "eagerness": "medium",
                "create_response": True,
                "interrupt_response": True,
            },
        },
    }


def build_welcome_response() -> dict[str, Any]:
    return {
        "type": "response.create",
        "response": {
            "modalities": ["audio", "text"],
            "instructions": (
                "Accueille l'utilisateur en une phrase breve, puis demande exactement : "
                "\"Qu'est-ce qui doit vraiment avancer maintenant ?\""
            ),
        },
    }


def drain_queue(queue: asyncio.Queue[bytes]) -> None:
    while True:
        try:
            queue.get_nowait()
            queue.task_done()
        except asyncio.QueueEmpty:
            return


async def send_microphone_audio(
    websocket: Any,
    input_queue: asyncio.Queue[bytes],
    stop_event: asyncio.Event,
) -> None:
    while not stop_event.is_set():
        chunk = await input_queue.get()
        payload = base64.b64encode(chunk).decode("ascii")
        await websocket.send(
            json.dumps({"type": "input_audio_buffer.append", "audio": payload})
        )
        input_queue.task_done()


async def play_output_audio(
    output_queue: asyncio.Queue[bytes],
    stop_event: asyncio.Event,
    output_device: int | None,
) -> None:
    with sd.RawOutputStream(
        samplerate=SAMPLE_RATE,
        blocksize=BLOCKSIZE,
        channels=CHANNELS,
        dtype=DTYPE,
        device=output_device,
    ) as stream:
        while not stop_event.is_set():
            chunk = await output_queue.get()
            await asyncio.to_thread(stream.write, chunk)
            output_queue.task_done()


async def receive_events(
    websocket: Any,
    output_queue: asyncio.Queue[bytes],
    stop_event: asyncio.Event,
    verbose: bool,
) -> None:
    async for raw_message in websocket:
        event = json.loads(raw_message)
        event_type = event.get("type", "")

        if verbose and event_type not in {"response.audio.delta", "response.output_audio.delta"}:
            print(f"< {event_type}")

        if event_type in {"response.audio.delta", "response.output_audio.delta"}:
            delta = event.get("delta")
            if delta:
                await output_queue.put(base64.b64decode(delta))
        elif event_type == "input_audio_buffer.speech_started":
            drain_queue(output_queue)
            try:
                await websocket.send(json.dumps({"type": "output_audio_buffer.clear"}))
            except Exception:
                pass
        elif event_type == "error":
            error = event.get("error", {})
            code = error.get("code") or error.get("type") or "unknown_error"
            message = error.get("message") or "Unknown Realtime API error"
            print(f"Realtime error ({code}): {message}")
            if code == "billing_not_active":
                print(
                    "Activate API billing for the OpenAI project that owns the key in .env, "
                    "then restart this agent."
                )
            stop_event.set()
        elif event_type in {"session.updated", "response.done"} and verbose:
            print(json.dumps(event, indent=2, ensure_ascii=False))

    stop_event.set()


async def run_agent(args: argparse.Namespace) -> None:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is missing. Put it in .env or export it.")

    model = args.model or os.getenv("OPENAI_REALTIME_MODEL", DEFAULT_MODEL)
    voice = args.voice or os.getenv("OPENAI_REALTIME_VOICE", DEFAULT_VOICE)
    uri = f"wss://api.openai.com/v1/realtime?model={model}"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "OpenAI-Beta": "realtime=v1",
    }

    input_queue: asyncio.Queue[bytes] = asyncio.Queue(maxsize=50)
    output_queue: asyncio.Queue[bytes] = asyncio.Queue(maxsize=200)
    stop_event = asyncio.Event()
    loop = asyncio.get_running_loop()

    def request_stop() -> None:
        stop_event.set()

    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, request_stop)
        except NotImplementedError:
            pass

    def enqueue_microphone_chunk(chunk: bytes) -> None:
        try:
            input_queue.put_nowait(chunk)
        except asyncio.QueueFull:
            pass

    def microphone_callback(indata: bytes, frames: int, time: Any, status: sd.CallbackFlags) -> None:
        if status and args.verbose:
            print(status)
        if stop_event.is_set():
            return
        loop.call_soon_threadsafe(enqueue_microphone_chunk, bytes(indata))

    print(f"Connecting to Realtime model {model} with voice {voice}...")

    async with websockets.connect(uri, additional_headers=headers) as websocket:
        await websocket.send(json.dumps(build_session_update(model=model, voice=voice)))
        await websocket.send(json.dumps(build_welcome_response()))

        with sd.RawInputStream(
            samplerate=SAMPLE_RATE,
            blocksize=BLOCKSIZE,
            channels=CHANNELS,
            dtype=DTYPE,
            callback=microphone_callback,
            device=args.input_device,
        ):
            print("Agent ready. Speak naturally. Press Ctrl-C to stop.")
            tasks = [
                asyncio.create_task(send_microphone_audio(websocket, input_queue, stop_event)),
                asyncio.create_task(play_output_audio(output_queue, stop_event, args.output_device)),
                asyncio.create_task(receive_events(websocket, output_queue, stop_event, args.verbose)),
            ]

            await stop_event.wait()
            for task in tasks:
                task.cancel()
            await asyncio.gather(*tasks, return_exceptions=True)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Realtime Voice Chief of Staff")
    parser.add_argument("--model", help=f"Realtime model. Default: {DEFAULT_MODEL}")
    parser.add_argument("--voice", help=f"Realtime voice. Default: {DEFAULT_VOICE}")
    parser.add_argument("--input-device", type=int, help="sounddevice input device id")
    parser.add_argument("--output-device", type=int, help="sounddevice output device id")
    parser.add_argument("--list-devices", action="store_true", help="list audio devices and exit")
    parser.add_argument("--verbose", action="store_true", help="print Realtime events")
    return parser.parse_args()


def main() -> None:
    load_dotenv(ROOT / ".env")
    args = parse_args()

    if args.list_devices:
        print(sd.query_devices())
        return

    try:
        asyncio.run(run_agent(args))
    except KeyboardInterrupt:
        pass
    except Exception as exc:
        raise SystemExit(f"Error: {exc}") from exc


if __name__ == "__main__":
    main()
