// AudioWorkletProcessor that captures mic audio, resamples to 16kHz if needed,
// and posts Int16 PCM chunks to the main thread.
// Runs in the audio render thread (not main), so it avoids glitches when the UI is busy.

class VoiceCaptureProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super()
    this.targetRate = 16000
    this.inputRate = sampleRate // global in the worklet scope
    this.ratio = this.inputRate / this.targetRate
    this.buffer = []
    this.chunkSize = 4096 // samples at target rate before posting
  }

  process(inputs) {
    const input = inputs[0]
    if (!input || input.length === 0) return true
    const channel = input[0]
    if (!channel || channel.length === 0) return true

    // Compute RMS for the UI level meter.
    let sum = 0
    for (let i = 0; i < channel.length; i++) sum += channel[i] * channel[i]
    const rms = Math.sqrt(sum / channel.length)

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
