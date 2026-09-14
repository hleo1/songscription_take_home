// Node-side MIDI → MP3 for the seed. The browser upload (src/lib/midi-to-mp3.ts)
// renders with a Tone.js PolySynth, which needs Web Audio, so this synthesizes
// the same default Tone.Synth voice directly: a triangle oscillator with a
// 5 ms linear attack, 100 ms exponential decay to 30% sustain and 1 s release,
// scaled by velocity, voices summed, plus a 1 s tail. Encoded with lamejs.
import * as lameModule from "@breezystack/lamejs";
import * as midiModule from "@tonejs/midi";

// Both packages are CJS-flavoured: the export may sit on the namespace or default.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const lame = lameModule as any;
const Mp3Encoder = lame.Mp3Encoder ?? lame.default?.Mp3Encoder;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const midiLib = midiModule as any;
export const Midi = midiLib.Midi ?? midiLib.default?.Midi;

const SAMPLE_RATE = 44100;
const ATTACK = 0.005;
const DECAY = 0.1;
const SUSTAIN = 0.3;
const RELEASE = 1;
const TAIL = 1; // seconds after the last note, so it can ring out

/** Envelope level `t` seconds into a note held for `held` seconds. */
function envelope(t: number, held: number): number {
  const level = (s: number) =>
    s < ATTACK
      ? s / ATTACK
      : SUSTAIN + (1 - SUSTAIN) * Math.exp((-5 * (s - ATTACK)) / DECAY);
  if (t < held) return level(t);
  return level(held) * Math.exp((-5 * (t - held)) / RELEASE);
}

/** Renders a MIDI file to MP3 bytes; `durationSec` includes the tail. */
export function renderMidiToMp3(bytes: Buffer): {
  mp3: Buffer;
  durationSec: number;
} {
  const midi = new Midi(bytes);
  if (!midi.duration || !Number.isFinite(midi.duration))
    throw new Error("This MIDI file has no playable notes.");
  const durationSec = midi.duration + TAIL;
  const mix = new Float32Array(Math.ceil(durationSec * SAMPLE_RATE));

  for (const track of midi.tracks)
    for (const note of track.notes) {
      const held = Math.max(0.05, note.duration);
      const freq = 440 * 2 ** ((note.midi - 69) / 12);
      const start = Math.floor(note.time * SAMPLE_RATE);
      const end = Math.min(
        mix.length,
        start + Math.ceil((held + RELEASE) * SAMPLE_RATE),
      );
      for (let i = start; i < end; i++) {
        const t = (i - start) / SAMPLE_RATE;
        const phase = (freq * t + 0.25) % 1;
        const triangle = 1 - 4 * Math.abs(phase - 0.5);
        mix[i] += triangle * envelope(t, held) * note.velocity;
      }
    }

  // Same encoding as the browser path: stereo, 128 kbps, clamped to int16.
  const pcm = new Int16Array(mix.length);
  for (let i = 0; i < mix.length; i++) {
    const s = Math.max(-1, Math.min(1, mix[i]));
    pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  const encoder = new Mp3Encoder(2, SAMPLE_RATE, 128);
  const chunks: Uint8Array[] = [];
  for (let i = 0; i < pcm.length; i += 1152) {
    const block = pcm.subarray(i, i + 1152);
    const buf = encoder.encodeBuffer(block, block);
    if (buf.length) chunks.push(new Uint8Array(buf));
  }
  const tail = encoder.flush();
  if (tail.length) chunks.push(new Uint8Array(tail));
  return { mp3: Buffer.concat(chunks), durationSec };
}
