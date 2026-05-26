/**
 * AudioWorklet inline — captura PCM 16-bit del micrófono y envía buffers
 * de 2048 samples al hilo principal vía MessagePort.
 *
 * Se sirve como Blob URL al cargar para no requerir un archivo .js estático.
 */

export const AUDIO_WORKLET_SRC = `
class LexAudioCaptureProcessor extends AudioWorkletProcessor {
  // Buffer de 2048 samples = ~128ms a 16kHz
  buffer = new Int16Array(2048);
  bufferWriteIndex = 0;

  constructor() {
    super();
  }

  process(inputs) {
    if (!inputs[0] || !inputs[0][0]) return true;
    const float32Channel = inputs[0][0];
    for (let i = 0; i < float32Channel.length; i++) {
      // Float32 (-1, 1) → Int16 (-32768, 32767)
      const sample = Math.max(-1, Math.min(1, float32Channel[i]));
      this.buffer[this.bufferWriteIndex++] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      if (this.bufferWriteIndex >= this.buffer.length) {
        this.port.postMessage({
          type: 'chunk',
          buffer: this.buffer.slice(0, this.bufferWriteIndex).buffer,
        });
        this.bufferWriteIndex = 0;
      }
    }
    return true;
  }
}

registerProcessor('lex-audio-capture', LexAudioCaptureProcessor);
`
