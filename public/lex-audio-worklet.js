/**
 * AudioWorklet de captura PCM 16-bit del micrófono para el agente Lex.
 *
 * Se sirve como archivo estático (no blob) para que pase la CSP del admin
 * (script-src 'self'). Cargado vía `audioContext.audioWorklet.addModule()`
 * en useLexAgent.
 *
 * Pipeline: mic → AudioWorklet → message a main thread → base64 → WebSocket
 * → Gemini Live API (formato PCM 16kHz mono).
 */

class LexAudioCaptureProcessor extends AudioWorkletProcessor {
  // Buffer de 2048 samples = ~128ms a 16kHz
  buffer = new Int16Array(2048)
  bufferWriteIndex = 0

  process(inputs) {
    if (!inputs[0] || !inputs[0][0]) return true
    const float32Channel = inputs[0][0]
    for (let i = 0; i < float32Channel.length; i++) {
      const sample = Math.max(-1, Math.min(1, float32Channel[i]))
      this.buffer[this.bufferWriteIndex++] = sample < 0 ? sample * 0x8000 : sample * 0x7fff
      if (this.bufferWriteIndex >= this.buffer.length) {
        this.port.postMessage({
          type: 'chunk',
          buffer: this.buffer.slice(0, this.bufferWriteIndex).buffer,
        })
        this.bufferWriteIndex = 0
      }
    }
    return true
  }
}

registerProcessor('lex-audio-capture', LexAudioCaptureProcessor)
