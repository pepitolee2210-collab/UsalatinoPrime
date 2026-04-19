// AudioWorkletProcessor that captures mic audio, resamples to 16kHz if needed,
// applies a dynamic noise gate and posts Int16 PCM chunks to the main thread.
// Runs in the audio render thread — glitch-free under UI load.
//
// Noise gate: during the first ~1.5s it samples ambient RMS to learn the
// "noise floor", then only lets audio through when RMS >= noiseFloor * multiplier.
// A hold-time keeps the gate open briefly after speech ends (avoids cutting
// off the tail of words).
//
// Adaptive recalibration: after calibration, if the gate stays closed for >3s
// straight (sustained silence), we gently update noiseFloor toward the
// observed ambient level. Handles "someone turns on TV mid-call" without any
// user intervention. We never update while the gate is open (that would pull
// the floor up toward speech energy and break detection).
//
// Messages posted to main thread:
//   { rms }                              — every frame, for the UI level meter
//   { pcm, rms }                         — only when gate is open; PCM is the
//                                          transferable buffer to send to Gemini
//   { type: 'calibrated', noiseFloor }  — once, when initial calibration ends
//   { type: 'stats', framesTotal,       — every ~10s, for observability
//     framesGateOpen, framesGateClosed,
//     noiseFloor }

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
    this.minGateAbsolute = opts.minGateAbsolute != null ? opts.minGateAbsolute : 0.012
    this.maxGateAbsolute = opts.maxGateAbsolute != null ? opts.maxGateAbsolute : 0.05
    this.statsIntervalSec = opts.statsIntervalSec != null ? opts.statsIntervalSec : 10
    this.recalibrateAfterSec = opts.recalibrateAfterSec != null ? opts.recalibrateAfterSec : 3

    // Calibration state — collects frame RMS values to compute a median at
    // the end. Median is robust against transient spikes (mic-enable click,
    // autoGainControl settling, the user speaking too soon), which used to
    // push the mean against the ceiling and disable the gate in practice.
    this.samplesObserved = 0
    this.calibrationRms = []
    this.noiseFloor = this.minGateAbsolute
    this.calibrated = false
    this.calibrationRetries = 0
    this.maxCalibrationRetries = 2

    // Gate state
    this.lastSpeechTime = -Infinity
    this.silenceStart = 0

    // Stats
    this.framesTotal = 0
    this.framesGateOpen = 0
    this.framesGateClosed = 0
    this.lastStatsEmit = 0
  }

  emitStats(now) {
    this.port.postMessage({
      type: 'stats',
      framesTotal: this.framesTotal,
      framesGateOpen: this.framesGateOpen,
      framesGateClosed: this.framesGateClosed,
      noiseFloor: this.noiseFloor,
      t: now,
    })
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
      this.calibrationRms.push(rms)
      this.samplesObserved += channel.length
      if (this.samplesObserved >= this.calibrationSamples) {
        // Median instead of mean: resistant to spikes.
        const sorted = this.calibrationRms.slice().sort((a, b) => a - b)
        const median = sorted[Math.floor(sorted.length / 2)]
        const rawFloor = Math.min(this.maxGateAbsolute, Math.max(this.minGateAbsolute, median))

        // If the calibration landed pegged to the ceiling, the ambient
        // likely had a sustained loud event (mic settling, user talking).
        // Give it another window — up to maxCalibrationRetries — before
        // committing to a floor that'll disable the gate.
        const pinnedHigh = rawFloor >= this.maxGateAbsolute * 0.95
        if (pinnedHigh && this.calibrationRetries < this.maxCalibrationRetries) {
          this.calibrationRetries += 1
          this.calibrationRms.length = 0
          this.samplesObserved = 0
          this.port.postMessage({ type: 'calibration-retry', attempt: this.calibrationRetries, floor: rawFloor })
          this.port.postMessage({ rms })
          return true
        }

        this.noiseFloor = rawFloor
        this.calibrated = true
        this.silenceStart = currentTime
        this.lastStatsEmit = currentTime
        this.calibrationRms.length = 0 // free memory
        this.port.postMessage({ type: 'calibrated', noiseFloor: this.noiseFloor })
      }
      this.port.postMessage({ rms })
      return true
    }

    const now = currentTime
    const threshold = this.noiseFloor * this.gateMultiplier
    if (rms >= threshold) {
      this.lastSpeechTime = now
      this.silenceStart = 0 // any speech resets the recalibration window
    }
    const gateOpen = now - this.lastSpeechTime < this.holdSeconds

    this.framesTotal += 1
    if (gateOpen) this.framesGateOpen += 1
    else this.framesGateClosed += 1

    // Adaptive recalibration during sustained silence.
    if (!gateOpen) {
      if (this.silenceStart === 0) this.silenceStart = now
      if (now - this.silenceStart > this.recalibrateAfterSec) {
        // EMA toward the current rms; clamp within absolute bounds.
        const updated = 0.9 * this.noiseFloor + 0.1 * rms
        this.noiseFloor = Math.min(this.maxGateAbsolute, Math.max(this.minGateAbsolute, updated))
      }
    }

    // Periodic stats emission
    if (now - this.lastStatsEmit >= this.statsIntervalSec) {
      this.emitStats(now)
      this.lastStatsEmit = now
    }

    if (!gateOpen) {
      // Silence: only post level for the UI, drop audio.
      this.port.postMessage({ rms })
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
