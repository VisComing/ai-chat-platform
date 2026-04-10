'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { Mic, MicOff, Loader2 } from 'lucide-react'

interface VoiceInputProps {
  onResult: (text: string, isFinal: boolean) => void
  onError?: (error: string) => void
  disabled?: boolean
}

type VoiceStatus = 'idle' | 'recording' | 'processing'

export function VoiceInput({ onResult, onError, disabled }: VoiceInputProps) {
  const [status, setStatus] = React.useState<VoiceStatus>('idle')
  const [volume, setVolume] = React.useState(0)

  // WebSocket and Audio refs
  const wsRef = React.useRef<WebSocket | null>(null)
  const audioContextRef = React.useRef<AudioContext | null>(null)
  const workletNodeRef = React.useRef<AudioWorkletNode | null>(null)
  const streamRef = React.useRef<MediaStream | null>(null)
  const analyserRef = React.useRef<AnalyserNode | null>(null)
  const volumeCheckIntervalRef = React.useRef<number | null>(null)

  // Start recording
  const startRecording = React.useCallback(async () => {
    try {
      setStatus('recording')

      // 1. Get microphone access with enhanced noise suppression
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          // Note: highPassFilter is not in standard MediaTrackConstraints type
          // but is supported by some browsers. Removed for type safety.
          sampleRate: 16000,
          channelCount: 1,        // Force mono for ASR
        }
      })
      streamRef.current = stream

      // 2. Create AudioContext (forced 16kHz for ASR)
      const audioContext = new AudioContext({ sampleRate: 16000 })
      audioContextRef.current = audioContext

      const source = audioContext.createMediaStreamSource(stream)

      // 3. Create AnalyserNode for volume visualization
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)
      analyserRef.current = analyser

      // 4. Load AudioWorklet for PCM processing
      // Note: We'll use ScriptProcessorNode as fallback since AudioWorklet requires separate file
      // For simplicity, using ScriptProcessorNode here

      const bufferSize = 4096
      const scriptProcessor = audioContext.createScriptProcessor(bufferSize, 1, 1)
      source.connect(scriptProcessor)
      scriptProcessor.connect(audioContext.destination)

      scriptProcessor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0)
        // Convert Float32 to Int16 PCM
        const pcmData = new Int16Array(inputData.length)
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]))
          pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
        }

        // Send to WebSocket if connected
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          // Convert to base64
          const base64 = arrayBufferToBase64(pcmData.buffer)
          wsRef.current.send(JSON.stringify({
            type: 'audio',
            data: base64,
          }))
        }
      }

      workletNodeRef.current = scriptProcessor as unknown as AudioWorkletNode

      // 5. Setup volume visualization
      const dataArray = new Uint8Array(analyser.frequencyBinCount)
      volumeCheckIntervalRef.current = window.setInterval(() => {
        analyser.getByteFrequencyData(dataArray)
        // Calculate average volume
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length
        setVolume(Math.min(100, avg * 2)) // Scale to 0-100
      }, 100)

      // 6. Connect to WebSocket
      // Note: Next.js rewrites don't support WebSocket proxy, connect directly to backend
      // TODO: In production, use proper WebSocket proxy or same origin
      const wsUrl = 'ws://localhost:8000/api/v1/speech/stream'
      const ws = new WebSocket(wsUrl)

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'start' }))
      }

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data)

        if (data.type === 'connected') {
          console.log('[VoiceInput] ASR connected')
        } else if (data.type === 'result') {
          onResult(data.text, data.is_final)
        } else if (data.type === 'error') {
          console.error('[VoiceInput] ASR error:', data.message)
          onError?.(data.message)
          // Stop recording and reset status
          stopRecording()
        } else if (data.type === 'completed') {
          console.log('[VoiceInput] ASR completed')
          // Stop recording and reset status
          stopRecording()
        }
      }

      ws.onerror = (error) => {
        console.error('[VoiceInput] WebSocket error:', error)
        onError?.('WebSocket connection error')
        stopRecording()
      }

      ws.onclose = () => {
        console.log('[VoiceInput] WebSocket closed')
      }

      wsRef.current = ws

    } catch (err) {
      console.error('[VoiceInput] Failed to start recording:', err)
      onError?.('无法访问麦克风，请检查权限设置')
      setStatus('idle')
    }
  }, [onResult, onError])

  // Stop recording
  const stopRecording = React.useCallback(() => {
    // Clear volume check interval
    if (volumeCheckIntervalRef.current) {
      clearInterval(volumeCheckIntervalRef.current)
      volumeCheckIntervalRef.current = null
    }

    // Stop audio processing
    if (workletNodeRef.current) {
      workletNodeRef.current.disconnect()
      workletNodeRef.current = null
    }

    // Close AudioContext
    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }

    // Stop media stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }

    // Send stop message and close WebSocket
    if (wsRef.current) {
      if (wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'stop' }))
      }
      wsRef.current.close()
      wsRef.current = null
    }

    setVolume(0)

    // Reset status to idle after a short delay
    // This allows the 'processing' state to be visible briefly
    setTimeout(() => {
      setStatus('idle')
    }, 500)
  }, [])

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      stopRecording()
    }
  }, [stopRecording])

  // Handle button click
  const handleClick = () => {
    if (status === 'idle') {
      startRecording()
    } else {
      setStatus('processing')
      stopRecording()
    }
  }

  return (
    <div className="flex items-center gap-2">
      {/* Mic button - match InputArea button style */}
      <button
        onClick={handleClick}
        disabled={disabled}
        className={cn(
          'flex items-center gap-1 sm:gap-1.5 h-8 px-2 sm:px-3 rounded-full text-sm font-medium transition-all duration-200',
          disabled && 'opacity-50 cursor-not-allowed',
          status === 'idle' && 'bg-[#f5f5f5] dark:bg-white/5 text-[#64748b] hover:bg-[#e5e7eb] dark:hover:bg-white/10',
          status === 'recording' && 'bg-red-500/10 text-red-500',
          status === 'processing' && 'bg-[#f5f5f5] dark:bg-white/5 text-[#94a3b8]',
        )}
        title={status === 'idle' ? '语音输入' : status === 'recording' ? '停止录音' : '识别中'}
        type="button"
      >
        {status === 'idle' ? (
          <Mic className="w-4 h-4" />
        ) : status === 'recording' ? (
          <>
            <MicOff className="w-4 h-4" />
            <span className="hidden sm:inline text-xs">停止</span>
          </>
        ) : (
          <Loader2 className="w-4 h-4 animate-spin" />
        )}
      </button>

      {/* Volume bars visualization */}
      {status === 'recording' && (
        <div className="flex items-center gap-0.5 h-4">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="w-0.5 bg-red-500 rounded-full transition-all duration-100"
              style={{
                height: `${Math.max(2, Math.min(16, volume * (0.3 + i * 0.15)))}px`,
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// Helper: Convert ArrayBuffer to Base64
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}