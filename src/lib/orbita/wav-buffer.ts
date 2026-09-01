// ÓRBITA — Buffer WAV helper (PCM 16-bit estéreo 44.1kHz).

export class WriteableBuffer {
  private buf: Buffer;
  private offset = 0;

  constructor(sizeBytes: number) {
    this.buf = Buffer.alloc(sizeBytes);
  }

  writeInt16(v: number): void {
    this.buf.writeInt16LE(v, this.offset);
    this.offset += 2;
  }

  get data(): Buffer {
    return this.buf;
  }

  /** Envuelve los samples PCM en un WAV completo (header RIFF 44 bytes). */
  toWav(): Buffer {
    const header = Buffer.alloc(44);
    const dataLen = this.buf.length;
    header.write("RIFF", 0);
    header.writeUInt32LE(36 + dataLen, 4);
    header.write("WAVE", 8);
    header.write("fmt ", 12);
    header.writeUInt32LE(16, 16); // tamaño fmt
    header.writeUInt16LE(1, 20); // PCM
    header.writeUInt16LE(2, 22); // canales estéreo
    header.writeUInt32LE(44100, 24); // sample rate
    header.writeUInt32LE(44100 * 4, 28); // byte rate (2ch * 2bytes * sr)
    header.writeUInt16LE(4, 32); // block align
    header.writeUInt16LE(16, 34); // bits per sample
    header.write("data", 36);
    header.writeUInt32LE(dataLen, 40);
    return Buffer.concat([header, this.buf]);
  }
}
