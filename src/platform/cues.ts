import type { OutcomeKind } from "./outcome";

/** One oscillator voice, times in seconds from the start of the cue. */
export interface Note {
  freq: number;
  at: number;
  dur: number;
  gain: number;
  type?: OscillatorType;
  /** Glide target; the pitch ramps from `freq` to here over `dur`. */
  endFreq?: number;
}

const midi = (n: number) => 440 * 2 ** ((n - 69) / 12);

/** C-major pentatonic semitone offsets within an octave. */
const PENTATONIC = [0, 2, 4, 7, 9];
const PLACE_BASE = 72; // C5
const PLACE_GAIN = 0.8;

function placeFreq(step: number): number {
  const octave = Math.floor(step / PENTATONIC.length);
  return midi(PLACE_BASE + octave * 12 + PENTATONIC[step % PENTATONIC.length]);
}

/** Cues as data, so the sound design is testable without audio. */
export function cueFor(kind: OutcomeKind, faces: number, size: number): Note[] {
  switch (kind) {
    case "place": {
      const step = Math.min(Math.max(faces, 1), Math.max(size, 1)) - 1;
      return [{ freq: placeFreq(step), at: 0, dur: 0.07, gain: PLACE_GAIN }];
    }
    case "wrong":
      return [
        {
          freq: midi(55), // G3
          endFreq: midi(50), // D3
          at: 0,
          dur: 0.18,
          gain: PLACE_GAIN * 0.75,
          type: "triangle",
        },
      ];
    case "win":
      return [0, 4, 7, 12].map((semis, i) => ({
        freq: midi(72 + semis),
        at: i * 0.09,
        dur: i === 3 ? 0.23 : 0.12,
        gain: PLACE_GAIN,
      }));
    case "lose":
      return [67, 60].map((n, i) => ({
        freq: midi(n),
        at: i * 0.11,
        dur: 0.14,
        gain: PLACE_GAIN * 0.6,
        type: "triangle",
      }));
  }
}
