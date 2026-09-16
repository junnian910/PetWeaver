import { describe, expect, it } from 'vitest'
import { createVoiceCapture, enumerateMicDevices } from '../src/renderer/voice-capture.js'

describe('voice capture', () => {
  it('enumerates only audio input devices with fallback labels', async () => {
    const mediaDevices = {
      enumerateDevices: async () => [
        { kind: 'audioinput', deviceId: 'mic-1', label: '桌面麦克风' },
        { kind: 'audiooutput', deviceId: 'spk-1', label: '扬声器' },
        { kind: 'videoinput', deviceId: 'cam-1', label: '摄像头' },
        { kind: 'audioinput', deviceId: 'mic-2', label: '' }
      ]
    }
    const devices = await enumerateMicDevices(mediaDevices)
    expect(devices).toEqual([
      { deviceId: 'mic-1', label: '桌面麦克风' },
      { deviceId: 'mic-2', label: '麦克风 mic-2' }
    ])
  })

  it('streams smoothed RMS levels on animation frames', async () => {
    const frames = []
    const fakeStream = { getTracks: () => [{ stop: () => {} }] }
    const fakeAnalyser = { frequencyBinCount: 4, getByteTimeDomainData: (data) => data.set([138, 118, 128, 128]) }
    const fakeContext = {
      createMediaStreamSource: () => ({ connect: () => {} }),
      createAnalyser: () => fakeAnalyser,
      close: async () => {}
    }
    const mediaDevices = { getUserMedia: async () => fakeStream }
    const levelsReceived = []
    const capture = createVoiceCapture({
      mediaDevices,
      AudioContextImpl: function () { return fakeContext },
      requestFrame: (callback) => { frames.push(callback); return frames.length },
      cancelFrame: () => {},
      smoothing: 0.92,
      onLevel: (level) => levelsReceived.push(level)
    })
    await capture.start()
    expect(frames.length).toBe(1)
    for (let index = 0; index < 3; index += 1) {
      frames[frames.length - 1]()
    }
    expect(levelsReceived.length).toBeGreaterThanOrEqual(3)
    expect(levelsReceived.every((level) => level >= 0 && level <= 1)).toBe(true)
    expect(levelsReceived[1]).toBeGreaterThanOrEqual(levelsReceived[0])
    capture.stop()
  })

  it('downsamples microphone audio into 16kHz PCM16 chunks', async () => {
    const chunks = []
    let processor = null
    const fakeAnalyser = { frequencyBinCount: 4, getByteTimeDomainData: (data) => data.set([128, 128, 128, 128]) }
    const fakeContext = {
      sampleRate: 48000,
      createMediaStreamSource: () => ({ connect: () => {} }),
      createAnalyser: () => fakeAnalyser,
      createScriptProcessor: () => {
        processor = { onaudioprocess: null, connect: () => {}, buffer: null }
        return processor
      },
      createGain: () => ({ gain: { value: 1 }, connect: () => {} }),
      destination: {},
      close: async () => {}
    }
    const capture = createVoiceCapture({
      mediaDevices: { getUserMedia: async () => ({ getTracks: () => [{ stop: () => {} }] }) },
      AudioContextImpl: function () { return fakeContext },
      requestFrame: () => 1,
      cancelFrame: () => {},
      onPcm16k: (chunk) => chunks.push(chunk)
    })
    await capture.start()
    expect(processor).not.toBeNull()
    const input = new Float32Array(4096)
    for (let index = 0; index < input.length; index += 1) input[index] = Math.sin(index / 10) * 0.5
    processor.onaudioprocess({ inputBuffer: { getChannelData: () => input } })
    expect(chunks).toHaveLength(1)
    expect(chunks[0]).toBeInstanceOf(Int16Array)
    expect(chunks[0].length).toBe(Math.floor(4096 / 3))
    expect(chunks[0].some((sample) => sample !== 0)).toBe(true)
    capture.stop()
  })

  it('reports errors and stops cleanly when getUserMedia fails', async () => {
    const errors = []
    const capture = createVoiceCapture({
      mediaDevices: { getUserMedia: async () => { throw new Error('denied') } },
      AudioContextImpl: function () { throw new Error('unused') },
      requestFrame: () => 1,
      cancelFrame: () => {},
      onError: (error) => errors.push(error.message)
    })
    await capture.start()
    expect(errors).toEqual(['denied'])
  })
})
