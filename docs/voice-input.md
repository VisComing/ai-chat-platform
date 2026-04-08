# 语音输入功能指南

本文档整合了语音输入功能的设计方案和 ASR API 技术参考。

## 一、功能概述

### 1.1 选型决策

**采用火山引擎（豆包）流式语音识别**

| 服务 | 中文效果 | 成本 | VAD支持 | 实时结果 |
|------|---------|------|---------|---------|
| 火山引擎 ASR | ★★★★★ | 中等 | ✅ 内置 | ✅ |
| OpenAI Whisper | ★★★★☆ | 较高 | ❌ | ❌ |
| 阿里云语音服务 | ★★★★★ | 中等 | ✅ | ✅ |

**选择理由**：
1. 中文识别效果优秀
2. 内置 VAD 检测，自动判断语音结束
3. 支持实时中间结果，用户体验好
4. 支持热词功能，可定制专业词汇
5. 成本可控（约 0.02 元/分钟）

### 1.2 核心特性

- **实时流式识别**：WebSocket 二进制协议
- **中间结果返回**：用户说话时实时显示识别文字
- **VAD 自动检测**：静音 1 秒自动结束录音
- **多格式支持**：PCM/WAV/MP3/OGG

---

## 二、技术架构

### 2.1 整体流程

```
┌─────────────────────────────────────┐
│              前端                     │
│  音频采集 → PCM转换 → WebSocket上传  │
│  (MediaRecorder + AudioWorklet)      │
└─────────────────────────────────────┘
              ↓ WebSocket (二进制协议)
┌─────────────────────────────────────┐
│              后端                     │
│  WebSocket接收 → DoubaoASR → SSE返回 │
│                                      │
│              ↓                       │
│      火山引擎 ASR openspeech API      │
└─────────────────────────────────────┘
```

### 2.2 核心文件

**后端**：
- `backend/app/api/v1/speech.py` - WebSocket 路由
- `backend/app/services/doubao_asr_service.py` - ASR 服务封装

**前端**：
- `frontend/components/chat/VoiceInput.tsx` - 语音输入组件

---

## 三、二进制协议详解

### 3.1 WebSocket 连接地址

```
wss://openspeech.bytedance.com/api/v2/asr
```

### 3.2 Header 格式（4 字节）

```
Byte 0: [Protocol version (4bit)] [Header size (4bit)]
Byte 1: [Message type (4bit)] [Message type flags (4bit)]
Byte 2: [Serialization method (4bit)] [Compression (4bit)]
Byte 3: [Reserved (8bit)]
```

**消息类型**：
| 值 | 类型 | 说明 |
|----|------|------|
| `0b0001` | Full client request | 首包，包含配置参数 |
| `0b0010` | Audio only request | 音频数据包 |
| `0b1001` | Full server response | 服务端响应 |
| `0b1111` | Error message | 错误消息 |

**flags**：
- `0b0000` - 非最后一包
- `0b0010` - 最后一包

### 3.3 首包请求参数

```json
{
  "app": {
    "appid": "your_appid",
    "token": "your_token",
    "cluster": "your_cluster"
  },
  "user": {
    "uid": "user_001"
  },
  "audio": {
    "format": "raw",
    "codec": "raw",
    "rate": 16000,
    "bits": 16,
    "channel": 1,
    "language": "zh-CN"
  },
  "request": {
    "reqid": "uuid",
    "workflow": "audio_in,resample,partition,vad,fe,decode,nlu_punctuate",
    "sequence": 1,
    "nbest": 1,
    "show_utterances": true,
    "result_type": "single",
    "vad_signal": true,
    "vad_silence_time": "1000"
  }
}
```

**关键参数说明**：

| 参数 | 说明 |
|------|------|
| `vad_signal` | 开启 VAD 检测 |
| `vad_silence_time` | 静音多久后结束（毫秒） |
| `show_utterances` | 输出分句信息 |
| `result_type` | `single` 只返回当前分句 |
| `workflow` | 开启标点：添加 `nlu_punctuate` |

### 3.4 服务端响应格式

```json
{
  "reqid": "uuid",
  "code": 1000,
  "message": "Success",
  "sequence": -1,
  "result": [
    {
      "text": "这是字节跳动。",
      "utterances": [
        {
          "definite": true,
          "start_time": 0,
          "end_time": 1705,
          "text": "这是字节跳动。"
        }
      ]
    }
  ]
}
```

**关键字段**：
- `definite: true` - 分句最终结果
- `definite: false` - 中间结果（正在识别）

### 3.5 错误码

| 错误码 | 说明 |
|-------|------|
| 1000 | 成功 |
| 1001 | 请求参数无效 |
| 1002 | 无访问权限（token 无效） |
| 1003 | 访问超频（QPS 超限） |
| 1010 | 音频过长 |
| 1013 | 音频静音 |
| 1020 | 识别等待超时 |

---

## 四、后端实现

### 4.1 二进制协议封装器

```python
import struct
import gzip
import json
from enum import IntEnum

class MessageType(IntEnum):
    FULL_CLIENT_REQUEST = 0b0001
    AUDIO_ONLY_REQUEST = 0b0010
    FULL_SERVER_RESPONSE = 0b1001

class SerializationMethod(IntEnum):
    NO_SERIALIZATION = 0b0000
    JSON = 0b0001

class Compression(IntEnum):
    NO_COMPRESSION = 0b0000
    GZIP = 0b0001

def build_header(
    message_type: MessageType,
    flags: int = 0b0000,
    serialization: SerializationMethod = SerializationMethod.JSON,
    compression: Compression = Compression.GZIP,
) -> bytes:
    byte0 = 0x11  # version=1, header_size=1
    byte1 = (message_type << 4) | flags
    byte2 = (serialization << 4) | compression
    byte3 = 0x00
    return bytes([byte0, byte1, byte2, byte3])

def build_full_client_request(config: dict) -> bytes:
    header = build_header(
        message_type=MessageType.FULL_CLIENT_REQUEST,
        serialization=SerializationMethod.JSON,
        compression=Compression.GZIP,
    )
    payload = gzip.compress(json.dumps(config).encode('utf-8'))
    payload_size = struct.pack('>I', len(payload))
    return header + payload_size + payload

def build_audio_request(audio_data: bytes, is_last: bool = False) -> bytes:
    header = build_header(
        message_type=MessageType.AUDIO_ONLY_REQUEST,
        flags=0b0010 if is_last else 0b0000,
        serialization=SerializationMethod.NO_SERIALIZATION,
        compression=Compression.GZIP,
    )
    payload = gzip.compress(audio_data)
    payload_size = struct.pack('>I', len(payload))
    return header + payload_size + payload

def parse_server_response(data: bytes) -> dict:
    header = data[:4]
    payload_size = struct.unpack('>I', data[4:8])[0]
    payload_compressed = data[8:8+payload_size]
    payload = gzip.decompress(payload_compressed)
    return json.loads(payload.decode('utf-8'))
```

### 4.2 ASR 服务类

```python
import websockets
import asyncio
import uuid

class DoubaoASRService:
    WS_URL = "wss://openspeech.bytedance.com/api/v2/asr"

    def __init__(self, appid: str, token: str, cluster: str):
        self.appid = appid
        self.token = token
        self.cluster = cluster
        self.ws = None

    async def connect(self, on_result: callable, on_error: callable):
        url = self._build_auth_url()
        self.ws = await websockets.connect(url)

        config = {
            "app": {"appid": self.appid, "token": self.token, "cluster": self.cluster},
            "user": {"uid": "user_001"},
            "audio": {
                "format": "raw", "codec": "raw", "rate": 16000,
                "bits": 16, "channel": 1, "language": "zh-CN"
            },
            "request": {
                "reqid": str(uuid.uuid4()),
                "workflow": "audio_in,resample,partition,vad,fe,decode,nlu_punctuate",
                "sequence": 1,
                "nbest": 1,
                "show_utterances": True,
                "result_type": "single",
                "vad_signal": True,
                "vad_silence_time": "1000"
            }
        }

        await self.ws.send(build_full_client_request(config))
        asyncio.create_task(self._receive_loop(on_result, on_error))

    async def send_audio(self, audio_chunk: bytes, is_last: bool = False):
        if self.ws:
            await self.ws.send(build_audio_request(audio_chunk, is_last))

    async def _receive_loop(self, on_result, on_error):
        try:
            while self.ws:
                data = await self.ws.recv()
                response = parse_server_response(data)
                if response.get("code") == 1000:
                    on_result(response)
                else:
                    on_error(response.get("message", "Unknown error"))
        except Exception as e:
            on_error(str(e))

    async def close(self):
        if self.ws:
            await self.ws.close()
```

### 4.3 WebSocket API 路由

```python
from fastapi import WebSocket, WebSocketDisconnect
import base64

@router.websocket("/speech/stream")
async def speech_stream(websocket: WebSocket):
    await websocket.accept()

    asr_service = DoubaoASRService(
        appid=settings.DOUBAO_ASR_APPID,
        token=settings.DOUBAO_ASR_TOKEN,
        cluster=settings.DOUBAO_ASR_CLUSTER,
    )

    def on_result(response):
        result = response.get("result", [])
        if result:
            text = result[0].get("text", "")
            utterances = result[0].get("utterances", [])
            is_final = any(u.get("definite", False) for u in utterances)

            asyncio.run_coroutine_threadsafe(
                websocket.send_json({
                    "type": "result",
                    "text": text,
                    "is_final": is_final,
                }),
                asyncio.get_event_loop()
            )

    def on_error(message):
        asyncio.run_coroutine_threadsafe(
            websocket.send_json({"type": "error", "message": message}),
            asyncio.get_event_loop()
        )

    try:
        await asr_service.connect(on_result, on_error)

        while True:
            data = await websocket.receive_json()

            if data["type"] == "start":
                pass  # 已在 connect 中发送首包
            elif data["type"] == "audio":
                audio = base64.b64decode(data["data"])
                await asr_service.send_audio(audio)
            elif data["type"] == "stop":
                await asr_service.send_audio(b"", is_last=True)
                await asr_service.close()
                break

    except WebSocketDisconnect:
        await asr_service.close()
```

---

## 五、前端实现

### 5.1 音频采集与 PCM 转换

```typescript
async function startRecording() {
  // 1. 获取麦克风权限
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      sampleRate: 16000,
    }
  })

  // 2. 创建 AudioContext
  const audioContext = new AudioContext({ sampleRate: 16000 })
  const source = audioContext.createMediaStreamSource(stream)

  // 3. 音量检测
  const analyser = audioContext.createAnalyser()
  source.connect(analyser)

  // 4. 建立 WebSocket 连接
  ws = new WebSocket('ws://localhost:8000/api/v1/speech/stream')
  ws.send(JSON.stringify({ type: 'start' }))
}
```

### 5.2 AudioWorklet PCM 处理

```typescript
// pcm-processor.js (AudioWorklet)
class PCMProcessor extends AudioWorkletProcessor {
  process(inputs: Float32Array[][]): boolean {
    const input = inputs[0][0] // 单声道
    if (input) {
      // Float32 → Int16 转换
      const pcm16 = new Int16Array(input.length)
      for (let i = 0; i < input.length; i++) {
        pcm16[i] = Math.max(-32768, Math.min(32767, input[i] * 32768))
      }
      this.port.postMessage(pcm16)
    }
    return true
  }
}

registerProcessor('pcm-processor', PCMProcessor)
```

### 5.3 VoiceInput 组件

```typescript
interface VoiceInputProps {
  onResult: (text: string, isFinal: boolean) => void
  onError?: (error: string) => void
  disabled?: boolean
}

export function VoiceInput({ onResult, onError, disabled }: VoiceInputProps) {
  const [status, setStatus] = useState<'idle' | 'recording' | 'processing'>('idle')
  const [volume, setVolume] = useState(0)
  const [interimText, setInterimText] = useState('')

  const wsRef = useRef<WebSocket | null>(null)

  const handleStart = async () => {
    try {
      setStatus('recording')
      await startRecording()
    } catch (err) {
      onError?.('无法访问麦克风')
      setStatus('idle')
    }
  }

  const handleStop = () => {
    stopRecording()
    wsRef.current?.send(JSON.stringify({ type: 'stop' }))
    setStatus('processing')
  }

  return (
    <div className="voice-input">
      <button
        onClick={status === 'idle' ? handleStart : handleStop}
        disabled={disabled}
        className={cn(
          'p-2 rounded-lg transition-all',
          status === 'recording' && 'bg-red-500 animate-pulse',
          status === 'processing' && 'bg-gray-400 animate-spin',
        )}
      >
        {status === 'idle' ? <Mic /> : <MicOff />}
      </button>

      {status === 'recording' && (
        <VolumeVisualizer volume={volume} />
      )}

      {interimText && (
        <span className="text-gray-400 italic">{interimText}</span>
      )}
    </div>
  )
}
```

---

## 六、用户体验设计

### 6.1 交互流程

```
[空闲] 麦克风灰色
    ↓ 点击
[录音] 麦克风红色脉冲 + 音量波形
    ↓ 用户说话
[实时反馈] 上方显示淡色实时文字
    ↓ 静音 1 秒或点击停止
[完成] 文字填入输入框，可编辑
```

### 6.2 状态设计

| 状态 | 麦克风 | 输入框 | 反馈 |
|------|--------|--------|------|
| 空闲 | 灰色 Mic | 正常 | 无 |
| 录音中 | 红色脉冲 + 波形 | 禁用 | 淡色实时文字 |
| 处理中 | 加载动画 | 等待 | "正在识别..." |
| 完成 | 恢复灰色 | 文字填入 | Toast 提示 |

---

## 七、环境配置

### 7.1 后端 .env

```bash
# 豆包 ASR 配置
DOUBAO_ASR_APPID=your_appid
DOUBAO_ASR_TOKEN=your_token
DOUBAO_ASR_CLUSTER=your_cluster_id
```

### 7.2 获取方式

1. 登录火山引擎控制台
2. 开通「智能语音服务」
3. 创建应用，获取 AppID、Token、Cluster ID

---

## 八、成本评估

| 类型 | 价格 |
|------|------|
| 流式语音识别 | 约 0.02 元/分钟 |

**预估**：日均 1000 次，每次 30 秒，月成本约 600 元。

---

## 九、风险与备选方案

### 主要风险

1. 二进制协议封装复杂
2. WebSocket 连接稳定性
3. 浏览器录音权限弹窗体验

### 备选方案

如果火山引擎 ASR 集成困难：

- **OpenAI Whisper API**：HTTP API，无二进制协议，但成本高、无实时结果
- **浏览器 Web Speech API**：Chrome 兼容性好，作为降级方案

---

## 十、实现计划

### Phase 1: 后端 ASR 服务（1-2 天）
- 实现二进制协议封装器
- 实现 DoubaoASRService WebSocket 客户端
- 实现 FastAPI WebSocket 路由

### Phase 2: 前端录音组件（1-2 天）
- 实现 VoiceInput 组件
- AudioWorklet PCM 数据处理
- 音量可视化

### Phase 3: 集成优化（1 天）
- 集成到 InputArea 组件
- 错误处理
- VAD 自动停止优化

---

## 十一、参考资料

- [火山引擎语音服务文档](https://www.volcengine.com/docs/6561)
- [Web Audio API 文档](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [AudioWorklet 文档](https://developer.mozilla.org/en-US/docs/Web/API/AudioWorklet)

---

**文档版本**: v1.0  
**最后更新**: 2026-04-08