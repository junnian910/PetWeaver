const clamp01 = (value) => Math.max(0, Math.min(1, Number(value) || 0))

/**
 * 麦克风设备枚举与实时响度采集（WebAudio AnalyserNode）。
 * onLevel 收到 0..1 的归一化 RMS 响度，带轻微平滑。
 * 所有依赖均可注入，便于无浏览器环境单元测试。
 */
export async function enumerateMicDevices(mediaDevices = navigator.mediaDevices) {
  const devices = await mediaDevices.enumerateDevices()
  return devices
    .filter((device) => device.kind === 'audioinput')
    .map((device) => ({ deviceId: device.deviceId || '', label: device.label || ('麦克风 ' + String(device.deviceId || '').slice(0, 6)) }))
}

export function createVoiceCapture({
  mediaDevices = navigator.mediaDevices,
  AudioContextImpl = window.AudioContext || window.webkitAudioContext,
  requestFrame = (callback) => window.requestAnimationFrame(callback),
  cancelFrame = (handle) => window.cancelAnimationFrame(handle),
  deviceId = '',
  smoothing = 0.92,
  onLevel = null,
  onPcm16k = null,
  onError = null
} = {}) {
  let stopped = false
  let frame = null
  let context = null
  let stream = null
  let smoothed = 0

  const stop = () => {
    stopped = true
    if (frame !== null) { cancelFrame(frame); frame = null }
    stream?.getTracks().forEach((track) => track.stop())
    stream = null
    context?.close?.().catch?.(() => {})
    context = null
  }

  const start = async () => {
    stopped = false
    try {
      stream = await mediaDevices.getUserMedia({ audio: deviceId ? { deviceId: { exact: deviceId } } : true })
      context = new AudioContextImpl()
      const source = context.createMediaStreamSource(stream)
      const analyser = context.createAnalyser()
      analyser.fftSize = 1024
      source.connect(analyser)
      if (onPcm16k && typeof context.createScriptProcessor === 'function') {
        // 16kHz PCM16 降采样（供主进程流式 ASR 使用）；接到零增益节点
        // 保持拉流但绝不把麦克风声音回放到扬声器。
        const processor = context.createScriptProcessor(4096, 1, 1)
        processor.onaudioprocess = (event) => {
          if (stopped) return
          const input = event.inputBuffer.getChannelData(0)
          const ratio = context.sampleRate / 16000
          const length = Math.floor(input.length / ratio)
          const pcm = new Int16Array(length)
          for (let index = 0; index < length; index += 1) {
            const position = index * ratio
            const base = Math.floor(position)
            const fraction = position - base
            const sample = input[base] * (1 - fraction) + input[Math.min(base + 1, input.length - 1)] * fraction
            pcm[index] = Math.max(-32768, Math.min(32767, Math.round(sample * 32767)))
          }
          onPcm16k(pcm)
        }
        const silent = context.createGain()
        silent.gain.value = 0
        source.connect(processor)
        processor.connect(silent)
        silent.connect(context.destination)
      }
      const data = new Uint8Array(analyser.frequencyBinCount)
      const loop = () => {
        if (stopped) return
        analyser.getByteTimeDomainData(data)
        let sum = 0
        for (let index = 0; index < data.length; index += 1) {
          const sample = (data[index] - 128) / 128
          sum += sample * sample
        }
        const rms = Math.sqrt(sum / data.length)
        smoothed = Math.max(rms, smoothed * smoothing)
        onLevel?.(clamp01(smoothed))
        frame = requestFrame(loop)
      }
      loop()
    } catch (error) {
      stop()
      onError?.(error)
    }
  }

  return { start, stop }
}
