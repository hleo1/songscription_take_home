// Browser-side MIDI → MP3. MIDI carries no audio, so we synthesize it with
// Tone.js (offline render) and encode the result to MP3 with lamejs in a Web
// Worker. Heavy deps load only when a MIDI is actually converted.

export function isMidi(file: File): boolean {
  return (
    /\.midi?$/i.test(file.name) ||
    file.type === "audio/midi" ||
    file.type === "audio/x-midi"
  );
}

export async function midiToMp3(file: File): Promise<File> {
  const [midiMod, Tone] = await Promise.all([
    import("@tonejs/midi"),
    import("tone"),
  ]);
  // @tonejs/midi is CJS — the `Midi` class may live on the namespace or default.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Midi = (midiMod as any).Midi ?? (midiMod as any).default?.Midi;

  const midi = new Midi(await file.arrayBuffer());
  const duration = midi.duration;
  if (!duration || !isFinite(duration) || duration <= 0)
    throw new Error("This MIDI file has no playable notes.");

  const sampleRate = 44100;
  // Render every track through a polyphonic synth into an offline buffer.
  const rendered = await Tone.Offline(
    () => {
      for (const track of midi.tracks) {
        if (!track.notes.length) continue;
        const synth = new Tone.PolySynth(Tone.Synth).toDestination();
        synth.maxPolyphony = 128;
        for (const note of track.notes) {
          synth.triggerAttackRelease(
            note.name,
            Math.max(0.05, note.duration),
            note.time,
            note.velocity,
          );
        }
      }
    },
    duration + 1, // small tail so the final notes ring out
    2,
    sampleRate,
  );

  const audio = rendered.get() as AudioBuffer;
  const channels = Array.from(
    { length: Math.min(2, audio.numberOfChannels) },
    (_, i) => audio.getChannelData(i),
  );
  const chunks = await encodeMp3(channels, sampleRate);

  const blob = new Blob(chunks as BlobPart[], { type: "audio/mpeg" });
  const base = file.name.replace(/\.midi?$/i, "") || "song";
  return new File([blob], `${base}.mp3`, { type: "audio/mpeg" });
}

/** Encodes PCM channels to MP3 chunks in mp3-encoder.worker.ts. */
function encodeMp3(
  channels: Float32Array[],
  sampleRate: number,
): Promise<Uint8Array[]> {
  const worker = new Worker(
    new URL("./mp3-encoder.worker.ts", import.meta.url),
    { type: "module" },
  );
  return new Promise<Uint8Array[]>((resolve, reject) => {
    worker.onmessage = (event: MessageEvent<Uint8Array[]>) =>
      resolve(event.data);
    worker.onerror = () =>
      reject(new Error("Could not encode this MIDI file to MP3."));
    worker.postMessage({ channels, sampleRate });
  }).finally(() => worker.terminate());
}
