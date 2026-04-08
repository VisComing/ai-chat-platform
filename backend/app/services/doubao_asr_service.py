"""
Doubao (Volcano Engine) Streaming ASR Service

 Implements the binary protocol for real-time speech recognition.
 WebSocket URL: wss://openspeech.bytedance.com/api/v2/asr

 Protocol Documentation: https://www.volcengine.com/docs/6561/80818
"""

import struct
import gzip
import json
import uuid
import asyncio
from enum import IntEnum
from typing import Optional, Callable, Any
import websockets


class MessageType(IntEnum):
    """Message types in the binary protocol"""
    FULL_CLIENT_REQUEST = 0b0001  # First packet with config
    AUDIO_ONLY_REQUEST = 0b0010   # Audio data packets
    FULL_SERVER_RESPONSE = 0b1001 # Server response
    ERROR_MESSAGE = 0b1111        # Error from server


class SerializationMethod(IntEnum):
    """Payload serialization methods"""
    NO_SERIALIZATION = 0b0000
    JSON = 0b0001


class Compression(IntEnum):
    """Payload compression methods"""
    NO_COMPRESSION = 0b0000
    GZIP = 0b0001


class ASRResult:
    """ASR recognition result"""
    def __init__(
        self,
        text: str,
        is_final: bool = False,
        utterances: list = None,
        confidence: float = 0.0,
    ):
        self.text = text
        self.is_final = is_final
        self.utterances = utterances or []
        self.confidence = confidence

    def __repr__(self):
        return f"ASRResult(text='{self.text}', is_final={self.is_final})"


def build_header(
    message_type: MessageType,
    message_type_specific_flags: int = 0b0000,
    serialization: SerializationMethod = SerializationMethod.JSON,
    compression: Compression = Compression.GZIP,
) -> bytes:
    """
    Build 4-byte binary header

    Byte 0: [version(4bit)] [header_size(4bit)] = 0x11
    Byte 1: [message_type(4bit)] [flags(4bit)]
    Byte 2: [serialization(4bit)] [compression(4bit)]
    Byte 3: reserved = 0x00
    """
    byte0 = 0x11  # version=1, header_size=1 (means 4 bytes)
    byte1 = (message_type << 4) | message_type_specific_flags
    byte2 = (serialization << 4) | compression
    byte3 = 0x00
    return bytes([byte0, byte1, byte2, byte3])


def build_full_client_request(config: dict, compression: Compression = Compression.GZIP) -> bytes:
    """
    Build full client request (first packet with configuration)

    Format: header + payload_size + payload
    """
    header = build_header(
        message_type=MessageType.FULL_CLIENT_REQUEST,
        message_type_specific_flags=0b0000,
        serialization=SerializationMethod.JSON,
        compression=compression,
    )

    # Serialize and compress payload
    payload_json = json.dumps(config, ensure_ascii=False).encode('utf-8')
    if compression == Compression.GZIP:
        payload = gzip.compress(payload_json)
    else:
        payload = payload_json

    # Payload size (4 bytes, big-endian unsigned int32)
    payload_size = struct.pack('>I', len(payload))

    return header + payload_size + payload


def build_audio_request(audio_data: bytes, is_last: bool = False) -> bytes:
    """
    Build audio-only request packet

    Args:
        audio_data: Raw PCM audio bytes (16kHz, 16bit, mono)
        is_last: True if this is the last packet
    """
    header = build_header(
        message_type=MessageType.AUDIO_ONLY_REQUEST,
        message_type_specific_flags=0b0010 if is_last else 0b0000,
        serialization=SerializationMethod.NO_SERIALIZATION,
        compression=Compression.GZIP,
    )

    # Compress audio data
    payload = gzip.compress(audio_data)

    # Payload size (4 bytes, big-endian)
    payload_size = struct.pack('>I', len(payload))

    return header + payload_size + payload


def parse_server_response(data: bytes) -> dict:
    """
    Parse server response

    Returns JSON dict with recognition result
    """
    if len(data) < 8:
        raise ValueError(f"Response too short: {len(data)} bytes")

    # Parse header (4 bytes)
    header = data[:4]
    print(f"[ASR Debug] Header bytes: {header.hex()}")

    message_type = (header[1] >> 4) & 0x0F
    compression = header[2] & 0x0F
    print(f"[ASR Debug] Message type: {message_type}, Compression: {compression}")

    # Check if it's an error message
    if message_type == MessageType.ERROR_MESSAGE:
        print("[ASR Debug] Received ERROR_MESSAGE from server")
        print(f"[ASR Debug] Total data length: {len(data)}")

        if len(data) < 12:
            return {
                "code": -1,
                "message": f"Error response too short: {len(data)} bytes",
                "is_error": True,
            }

        # Error format: header + error_code(4B) + error_size(4B) + error_message
        error_code = struct.unpack('>I', data[4:8])[0]
        error_size = struct.unpack('>I', data[8:12])[0]
        print(f"[ASR Debug] Error code: {error_code}, size: {error_size}")

        # Error message might be gzip compressed even if outer compression=0
        # Check the error message bytes directly
        error_msg_bytes = data[12:12+error_size]
        print(f"[ASR Debug] Error message bytes first 10: {error_msg_bytes[:min(10, len(error_msg_bytes))].hex()}")

        # Check if error message is gzip compressed (magic bytes 1f 8b)
        if len(error_msg_bytes) >= 2 and error_msg_bytes[0] == 0x1f and error_msg_bytes[1] == 0x8b:
            print("[ASR Debug] Error message is gzip compressed, decompressing...")
            try:
                error_msg = gzip.decompress(error_msg_bytes).decode('utf-8')
                print(f"[ASR Debug] Decompressed error message: {error_msg}")
            except Exception as e:
                print(f"[ASR Debug] Decompression failed: {e}")
                error_msg = error_msg_bytes.decode('utf-8', errors='replace')
        else:
            # Not compressed, decode directly
            try:
                error_msg = error_msg_bytes.decode('utf-8')
            except UnicodeDecodeError:
                error_msg = error_msg_bytes.decode('utf-8', errors='replace')

        print(f"[ASR Debug] Final error message: {error_msg}")
        return {
            "code": error_code,
            "message": error_msg,
            "is_error": True,
        }

    # Parse payload size (4 bytes, big-endian)
    payload_size = struct.unpack('>I', data[4:8])[0]
    print(f"[ASR Debug] Payload size: {payload_size}")

    # Extract and decompress payload
    payload_compressed = data[8:8+payload_size]
    print(f"[ASR Debug] Payload first 4 bytes: {payload_compressed[:4].hex() if len(payload_compressed) >= 4 else payload_compressed.hex()}")

    # Check if data is gzip compressed (magic bytes: 1f 8b)
    is_gzip = len(payload_compressed) >= 2 and payload_compressed[0] == 0x1f and payload_compressed[1] == 0x8b

    if compression == Compression.GZIP or is_gzip:
        print("[ASR Debug] Decompressing gzip payload")
        payload = gzip.decompress(payload_compressed)
    else:
        payload = payload_compressed

    return json.loads(payload.decode('utf-8'))


def extract_result_from_response(response: dict) -> Optional[ASRResult]:
    """
    Extract ASR result from server response

    Returns None if no valid result
    """
    # Check for errors
    if response.get("code") != 1000:
        return None

    result_list = response.get("result", [])
    if not result_list:
        return None

    result = result_list[0]
    text = result.get("text", "")
    confidence = result.get("confidence", 0)

    # Check if result is final (definite=true in utterances)
    utterances = result.get("utterances", [])
    is_final = False
    if utterances:
        # If any utterance has definite=True, it's a final sentence
        is_final = any(u.get("definite", False) for u in utterances)

    return ASRResult(
        text=text,
        is_final=is_final,
        utterances=utterances,
        confidence=confidence,
    )


class DoubaoASRService:
    """
    Doubao Streaming ASR Service

    Usage:
        service = DoubaoASRService(appid, token, cluster)
        await service.connect(on_result_callback, on_error_callback)
        await service.send_audio(audio_chunk)
        await service.send_audio(last_chunk, is_last=True)
        await service.close()
    """

    WS_URL = "wss://openspeech.bytedance.com/api/v2/asr"

    def __init__(
        self,
        appid: str,
        token: str,
        cluster: str,
        language: str = "zh-CN",
        enable_vad: bool = True,
        vad_silence_time: int = 1000,  # ms
        enable_itn: bool = True,       # Inverse Text Normalization
        enable_punctuation: bool = True,  # Auto punctuation
    ):
        self.appid = appid
        self.token = token
        self.cluster = cluster
        self.language = language
        self.enable_vad = enable_vad
        self.vad_silence_time = vad_silence_time
        self.enable_itn = enable_itn
        self.enable_punctuation = enable_punctuation

        self.ws: Optional[websockets.WebSocketClientProtocol] = None
        self._receive_task: Optional[asyncio.Task] = None
        self._sequence = 1
        self._connected = False

    async def connect(
        self,
        on_result: Callable[[ASRResult], None],
        on_error: Callable[[str], None],
    ) -> bool:
        """
        Establish WebSocket connection and send initial config

        Returns True if connected successfully
        """
        try:
            # Build URL with appid parameter
            ws_url = f"{self.WS_URL}?appid={self.appid}"
            print(f"[DoubaoASR] Connecting to {ws_url}...")

            # Build authorization header with Access Token
            headers = {
                "Authorization": f"Bearer; {self.token}"
            }

            # Connect to ASR service
            self.ws = await websockets.connect(
                ws_url,
                max_size=10 * 1024 * 1024,
                ping_interval=30,
                ping_timeout=10,
                additional_headers=headers,
            )

            print("[DoubaoASR] WebSocket connected, sending config...")

            # Build and send full client request
            config = self._build_config()
            print(f"[DoubaoASR] Config: appid={self.appid}, cluster={self.cluster}")
            request = build_full_client_request(config)
            print(f"[DoubaoASR] Request size: {len(request)} bytes")
            await self.ws.send(request)

            print("[DoubaoASR] Config sent, starting receive loop...")

            # Start receiving loop
            self._receive_task = asyncio.create_task(
                self._receive_loop(on_result, on_error)
            )
            self._connected = True

            return True

        except Exception as e:
            print(f"[DoubaoASR] Connection error: {type(e).__name__}: {e}")
            on_error(f"Connection error: {str(e)}")
            return False

    def _build_config(self) -> dict:
        """Build initial configuration payload"""
        # Build workflow based on settings
        workflow_parts = ["audio_in", "resample", "partition", "vad", "fe", "decode"]
        if self.enable_itn:
            workflow_parts.append("itn")  # Inverse Text Normalization
        if self.enable_punctuation:
            workflow_parts.append("nlu_punctuate")  # Auto punctuation
        workflow = ",".join(workflow_parts)

        return {
            "app": {
                "appid": self.appid,
                "token": self.token,
                "cluster": self.cluster,
            },
            "user": {
                "uid": f"user_{uuid.uuid4().hex[:16]}",
            },
            "audio": {
                "format": "raw",  # WAV container with PCM
                "codec": "raw",   # PCM encoding
                "rate": 16000,    # 16kHz sample rate
                "bits": 16,       # 16-bit depth
                "channel": 1,     # Mono
                "language": self.language,
            },
            "request": {
                "reqid": str(uuid.uuid4()),
                "workflow": workflow,
                "sequence": self._sequence,
                "nbest": 1,
                "show_utterances": True,
                "result_type": "single",  # Return single utterance results
                "vad_signal": self.enable_vad,
                "vad_silence_time": str(self.vad_silence_time),
            },
        }

    async def send_audio(self, audio_data: bytes, is_last: bool = False) -> bool:
        """
        Send audio data chunk

        Args:
            audio_data: PCM audio bytes (16kHz, 16bit, mono)
            is_last: True if this is the last chunk

        Returns True if sent successfully
        """
        if not self.ws or not self._connected:
            return False

        try:
            request = build_audio_request(audio_data, is_last)
            await self.ws.send(request)
            return True
        except Exception as e:
            return False

    async def _receive_loop(
        self,
        on_result: Callable[[ASRResult], None],
        on_error: Callable[[str], None],
    ):
        """Receive and process server responses"""
        try:
            while self.ws and self._connected:
                data = await self.ws.recv()
                print(f"[DoubaoASR] Received {len(data)} bytes")

                # Parse response
                try:
                    response = parse_server_response(data)
                    print(f"[DoubaoASR] Parsed response: {response.get('code', 'N/A')}")
                except Exception as parse_err:
                    print(f"[DoubaoASR] Parse error: {parse_err}")
                    on_error(f"Parse error: {str(parse_err)}")
                    continue

                # Check for errors
                if response.get("is_error") or response.get("code") != 1000:
                    error_msg = response.get("message", "Unknown error")
                    print(f"[DoubaoASR] Error response: {error_msg}")
                    on_error(error_msg)
                    continue

                # Extract result
                result = extract_result_from_response(response)
                if result and result.text:
                    print(f"[DoubaoASR] Result: '{result.text}', is_final={result.is_final}")
                    on_result(result)

        except websockets.exceptions.ConnectionClosed:
            self._connected = False
        except Exception as e:
            on_error(f"Receive error: {str(e)}")
            self._connected = False

    async def close(self):
        """Close WebSocket connection"""
        self._connected = False

        if self._receive_task:
            self._receive_task.cancel()
            try:
                await self._receive_task
            except asyncio.CancelledError:
                pass

        if self.ws:
            await self.ws.close()
            self.ws = None

    @property
    def is_connected(self) -> bool:
        return self._connected