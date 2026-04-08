"""
Speech Recognition WebSocket API

Provides real-time speech-to-text via Doubao (Volcano Engine) ASR service.

WebSocket endpoint: /api/v1/speech/stream

Client -> Server messages:
- {"type": "start"} - Start recognition session
- {"type": "audio", "data": "base64_encoded_pcm"} - Audio chunk (16kHz, 16bit, mono)
- {"type": "stop"} - End recognition

Server -> Client messages:
- {"type": "result", "text": "recognized text", "is_final": false} - Intermediate result
- {"type": "result", "text": "recognized text", "is_final": true} - Final result
- {"type": "error", "message": "error description"} - Error message
- {"type": "connected"} - Connection established
"""

import asyncio
import base64
import json
import logging
from fastapi import WebSocket, WebSocketDisconnect, Depends
from app.core.config import settings
from app.services.doubao_asr_service import DoubaoASRService, ASRResult

logger = logging.getLogger("app.speech")


async def get_asr_service() -> DoubaoASRService:
    """Create ASR service instance with settings"""
    return DoubaoASRService(
        appid=settings.doubao_asr_appid,
        token=settings.doubao_asr_token,
        cluster=settings.doubao_asr_cluster,
        language="zh-CN",
        enable_vad=settings.asr_enable_vad,
        vad_silence_time=settings.asr_vad_silence_time,
        enable_itn=settings.asr_enable_itn,
        enable_punctuation=settings.asr_enable_punctuation,
    )


# WebSocket router (we use direct app include instead of APIRouter for WebSocket)
async def speech_stream_endpoint(websocket: WebSocket):
    """
    Speech recognition WebSocket endpoint

    Flow:
    1. Client connects and sends {"type": "start"}
    2. Server connects to Doubao ASR and acknowledges
    3. Client sends audio chunks {"type": "audio", "data": "base64_pcm"}
    4. Server forwards to ASR, returns results in real-time
    5. Client sends {"type": "stop"} to end session
    """

    await websocket.accept()

    # Check if ASR credentials are configured
    if not settings.doubao_asr_appid or not settings.doubao_asr_token:
        await websocket.send_json({
            "type": "error",
            "message": "ASR service not configured. Please set DOUBAO_ASR_APPID and DOUBAO_ASR_TOKEN in .env"
        })
        await websocket.close()
        return

    asr_service = await get_asr_service()

    # Queue for sending results back to client
    result_queue: asyncio.Queue[dict] = asyncio.Queue()

    # Callbacks for ASR results
    def on_result(result: ASRResult):
        """Handle ASR recognition result"""
        asyncio.run_coroutine_threadsafe(
            result_queue.put({
                "type": "result",
                "text": result.text,
                "is_final": result.is_final,
            }),
            asyncio.get_event_loop()
        )

    def on_error(message: str):
        """Handle ASR error"""
        asyncio.run_coroutine_threadsafe(
            result_queue.put({
                "type": "error",
                "message": message,
            }),
            asyncio.get_event_loop()
        )

    # Task to send results to client
    async def send_results():
        """Send results from queue to WebSocket client"""
        while True:
            try:
                msg = await asyncio.wait_for(result_queue.get(), timeout=0.1)
                await websocket.send_json(msg)
            except asyncio.TimeoutError:
                continue
            except Exception:
                break

    send_task = None
    receiving = False

    try:
        while True:
            # Receive message from client
            raw_data = await websocket.receive()

            # Handle WebSocket disconnect
            if raw_data["type"] == "websocket.disconnect":
                break

            # Handle text message
            if "text" in raw_data:
                data = json.loads(raw_data["text"])

                if data["type"] == "start":
                    # Start ASR session
                    logger.info("Connecting to ASR service...")
                    try:
                        connected = await asr_service.connect(on_result, on_error)
                        logger.info(f"ASR connection result: {connected}")

                        if connected:
                            receiving = True
                            send_task = asyncio.create_task(send_results())
                            await websocket.send_json({"type": "connected"})
                        else:
                            await websocket.send_json({
                                "type": "error",
                                "message": "Failed to connect to ASR service"
                            })
                    except Exception as e:
                        logger.error(f"ASR connection failed: {e}")
                        await websocket.send_json({
                            "type": "error",
                            "message": f"ASR connection failed: {str(e)}"
                        })

                elif data["type"] == "audio":
                    # Process audio chunk
                    if not receiving:
                        await websocket.send_json({
                            "type": "error",
                            "message": "Session not started. Send 'start' first."
                        })
                        continue

                    # Decode base64 audio data
                    try:
                        audio_bytes = base64.b64decode(data["data"])
                        await asr_service.send_audio(audio_bytes)
                    except Exception as e:
                        await websocket.send_json({
                            "type": "error",
                            "message": f"Failed to process audio: {str(e)}"
                        })

                elif data["type"] == "stop":
                    # End recognition session
                    if receiving:
                        # Send last packet indicator
                        await asr_service.send_audio(b"", is_last=True)

                        # Wait for final results (with timeout)
                        await asyncio.sleep(1.0)

                        # Close ASR connection
                        await asr_service.close()

                        # Stop send task
                        if send_task:
                            send_task.cancel()
                            try:
                                await send_task
                            except asyncio.CancelledError:
                                pass

                        receiving = False
                        await websocket.send_json({"type": "completed"})

    except WebSocketDisconnect:
        pass
    except Exception as e:
        try:
            await websocket.send_json({
                "type": "error",
                "message": str(e)
            })
        except:
            pass

    finally:
        # Cleanup
        if receiving:
            await asr_service.close()
        if send_task:
            send_task.cancel()


# Export for router registration
# Note: WebSocket endpoints need to be added directly to app, not via APIRouter
# We'll create a function to get the endpoint for registration
def get_speech_websocket_route():
    """Get WebSocket route for speech recognition"""
    return speech_stream_endpoint