/** Only one audio element plays at a time, across the list's preview buttons
    and the detail panel's waveform player. Call when an element starts playing. */
let current: HTMLMediaElement | null = null;

export function claimPlayback(media: HTMLMediaElement) {
  if (current && current !== media) current.pause();
  current = media;
}
