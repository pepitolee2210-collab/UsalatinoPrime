// AudioWorkletProcessor that captures mic audio, resamples to 16kHz if needed,
// applies a dynamic noise gate and posts Int16 PCM chunks to the main thread.
// Runs in the audio render thread — glitch-free under UI load.
//
// Noise gate: during the first ~1.5s it samples ambient RMS to learn the
// "noise floor", then only lets audio through when RMS >= noiseFloor * multiplier.
// A hold-time keeps the gate open briefly after speech ends (avoids cutting
// off the tail of words).
//
// Messages posted to main thread:
//   { rms }                              — every frame, for the UI level meter
//   { pcm, rms }                         — only when gate is open; PCM is the
//                                          transferable buffer to send to Gemini
//   { type: 'calibrated', noiseFloor }  — once, when calibration finishes

class VoiceCaptureProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super()
    this.targetRate = 16000
    this.inputRate = sampleRate // worklet global
    this.ratio = this.inputRate / this.targetRate
    this.buffer = []
    this.chunkSize = 4096

    const opts = (options && options.processorOptions) || {}
    this.calibrationSamples = Math.floor(((opts.calibrationMs != null ? opts.calibrationMs : 1500) * this.inputRate) / 1000)
    this.gateMultiplier = opts.gateMultiplier != null ? opts.gateMultiplier : 2.5
    this.holdSeconds = (opts.holdMs != null ? opts.holdMs : 400) / 1000
    // Absolute floor so a dead-silent mic doesn't set a near-zero threshold.
    this.minGateAbsolute = opts.minGateAbsolute != null ? opts.minGateAbsolute : 0.012
    // Absolute ceiling so extreme background hiss can't disable the gate.
    this.maxGateAbsolute = opts.maxGateAbsolute != null ? opts.maxGateAbsolute : 0.05

    this.samplesObserved = 0
    this.noiseSum = 0
    this.noiseFrames = 0
    this.noiseFloor = this.minGateAbsolute
    this.calibrated = false
    this.lastSpeechTime = -Infinity
  }

  process(inputs) {
    const input = inputs[0]
    if (!input || input.length === 0) return true
    const channel = input[0]
    if (!channel || channel.length === 0) return true

    // Frame RMS
    let sum = 0
    for (let i = 0; i < channel.length; i++) sum += channel[i] * channel[i]
    const rms = Math.sqrt(sum / channel.length)

    // Calibration phase: just learn the noise floor, don't send audio yet.
    if (!this.calibrated) {
      this.noiseSum += rms
      this.noiseFrames += 1
      this.samplesObserved += channel.length
      if (this.samplesObserved >= this.calibrationSamples) {
        const avg = this.noiseSum / Math.max(1, this.noiseFrames)
        this.noiseFloor = Math.min(this.maxGateAbsolute, Math.max(this.minGateAbsolute, avg))
        this.calibrated = true
        this.port.postMessage({ type: 'calibrated', noiseFloor: this.noiseFloor })
      }
      this.port.postMessage({ rms })
      return true
    }

    // Gate decision
    const threshold = this.noiseFloor * this.gateMultiplier
    const now = currentTime // worklet global, seconds
    if (rms >= threshold) this.lastSpeechTime = now
    const gateOpen = now - this.lastSpeechTime < this.holdSeconds

    if (!gateOpen) {
      // Silence: only post level for the UI, drop audio.
      this.port.postMessage({ rms })
      // Reset buffer so we don't mix silence into the next speech burst.
      if (this.buffer.length > 0) this.buffer.length = 0
      return true
    }

    // Resample + quantize to Int16 and buffer
    if (this.ratio === 1) {
      for (let i = 0; i < channel.length; i++) {
        this.buffer.push(Math.max(-32768, Math.min(32767, Math.floor(channel[i] * 32768))))
      }
    } else {
      const outLen = Math.floor(channel.length / this.ratio)
      for (let i = 0; i < outLen; i++) {
        const s = channel[Math.floor(i * this.ratio)]
        this.buffer.push(Math.max(-32768, Math.min(32767, Math.floor(s * 32768))))
      }
    }

    while (this.buffer.length >= this.chunkSize) {
      const chunk = this.buffer.splice(0, this.chunkSize)
      const int16 = new Int16Array(chunk)
      this.port.postMessage({ pcm: int16.buffer, rms }, [int16.buffer])
    }

    return true
  }
}

registerProcessor('voice-capture-processor', VoiceCaptureProcessor)
