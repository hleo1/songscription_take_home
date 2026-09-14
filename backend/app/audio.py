import math
import tempfile

import essentia.standard as es

# Essentia spells keys with a mix of sharps and flats.
ROOTS = {
    "C": 0, "C#": 1, "Db": 1, "D": 2, "D#": 3, "Eb": 3, "E": 4, "F": 5,
    "F#": 6, "Gb": 6, "G": 7, "G#": 8, "Ab": 8, "A": 9, "A#": 10, "Bb": 10, "B": 11,
}  # fmt: skip


def analyze_audio(mp3: bytes) -> dict:
    """Measures tempo and key from the decoded MP3 signal (not from tags)."""
    with tempfile.NamedTemporaryFile(suffix=".mp3") as f:
        f.write(mp3)
        f.flush()
        audio, sample_rate, *_ = es.AudioLoader(filename=f.name)()
    mono = audio.mean(axis=1).astype("float32")
    key, scale, strength = es.KeyExtractor(
        averageDetuningCorrection=True, frameSize=4096, hopSize=4096, hpcpSize=12,
        maxFrequency=3500, maximumSpectralPeaks=60, minFrequency=25,
        pcpThreshold=0.2, profileType="bgate", sampleRate=sample_rate,
    )(mono)  # fmt: skip
    bpm = es.RhythmExtractor2013(maxTempo=208, method="multifeature", minTempo=40)(mono)[0]
    return {
        "bpm": min(240, max(20, math.floor(bpm + 0.5))),
        "originalRoot": ROOTS.get(key, 0),
        "originalMode": "Minor" if scale == "minor" else "Major",
        "keyConfidence": round(float(strength), 2),
    }
