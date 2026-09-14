// Web Worker: encodes PCM audio to MP3 with lamejs off the main thread, so a
// long MIDI conversion doesn't freeze the page. Receives { channels,
// sampleRate } from midiToMp3 and replies with the MP3 chunks in order.
import * as lame from "@breezystack/lamejs";

type EncodeRequest = { channels: Float32Array[]; sampleRate: number };

self.onmessage = (event: MessageEvent<EncodeRequest>) => {
  const { channels, sampleRate } = event.data;
  const Mp3Encoder =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (lame as any).Mp3Encoder ?? (lame as any).default?.Mp3Encoder;
  const encoder = new Mp3Encoder(channels.length, sampleRate, 128);

  const left = floatToInt16(channels[0]);
  const right = channels.length > 1 ? floatToInt16(channels[1]) : null;
  const block = 1152;
  const chunks: Uint8Array[] = [];
  for (let i = 0; i < left.length; i += block) {
    const l = left.subarray(i, i + block);
    const buf = right
      ? encoder.encodeBuffer(l, right.subarray(i, i + block))
      : encoder.encodeBuffer(l);
    if (buf.length) chunks.push(new Uint8Array(buf));
  }
  const tail = encoder.flush();
  if (tail.length) chunks.push(new Uint8Array(tail));
  postMessage(chunks);
};

function floatToInt16(f32: Float32Array): Int16Array {
  const out = new Int16Array(f32.length);
  for (let i = 0; i < f32.length; i++) {
    const s = Math.max(-1, Math.min(1, f32[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}
