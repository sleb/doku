import { cueFor } from "./cues";
import type { OutcomeKind } from "./outcome";

export interface Sound {
  /** Always resolves: a failed sound must never break gameplay. */
  play(kind: OutcomeKind, faces: number, size: number): Promise<void>;
  /** Call from a user gesture; creates the context on first use. Resolves
   * true once the context is running. */
  unlock(): Promise<boolean>;
  suspend(): void;
  resume(): void;
}

export interface SoundDeps {
  /** Null when Web Audio is missing. */
  createContext(): AudioContext | null;
  /** Receives swallowed failures. */
  log(err: unknown): void;
}

const MASTER_GAIN = 0.18;
const MAX_VOICES = 4;
const ATTACK = 0.005;

interface Voice {
  oscs: OscillatorNode[];
  live: number;
}

const defaultDeps: SoundDeps = {
  createContext: () => {
    if (typeof window === "undefined") return null;
    const w = window as unknown as {
      AudioContext?: typeof AudioContext;
      webkitAudioContext?: typeof AudioContext;
    };
    const Ctor = w.AudioContext ?? w.webkitAudioContext;
    return Ctor ? new Ctor() : null;
  },
  log: (err) => {
    if (import.meta.env.DEV) console.debug("sound:", err);
  },
};

export function createSound(deps: SoundDeps = defaultDeps): Sound {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let failed = false;
  let voices: Voice[] = [];
  let resuming: Promise<void> | null = null;

  const safe = (fn: () => unknown) => {
    try {
      const r = fn();
      if (r instanceof Promise) r.catch(deps.log);
    } catch (err) {
      deps.log(err);
    }
  };

  function ensure() {
    if (ctx || failed) return;
    try {
      const c = deps.createContext();
      if (!c) {
        failed = true;
        return;
      }
      const m = c.createGain();
      m.gain.value = MASTER_GAIN;
      m.connect(c.destination);
      ctx = c;
      master = m;
    } catch (err) {
      failed = true;
      deps.log(err);
    }
  }

  /** One shared in-flight resume, so a cue can wait for it instead of being lost. */
  function resumeOnce(c: AudioContext): Promise<void> {
    resuming ??= (async () => {
      try {
        await c.resume();
      } catch (err) {
        deps.log(err);
      } finally {
        resuming = null;
      }
    })();
    return resuming;
  }

  function dropOldest() {
    const old = voices.shift();
    if (!old) return;
    for (const o of old.oscs) safe(() => o.stop());
  }

  return {
    async unlock() {
      ensure();
      const c = ctx;
      if (!c) return false;
      await resumeOnce(c);
      return c.state === "running";
    },
    suspend() {
      const c = ctx;
      if (c) safe(() => c.suspend());
    },
    resume() {
      const c = ctx;
      if (c) safe(() => c.resume());
    },
    async play(kind, faces, size) {
      const c = ctx;
      const m = master;
      if (!c || !m) return;
      if (c.state !== "running") {
        // currentTime is frozen, so wait for the resume rather than schedule
        // into it (that would pile up and burst later) or drop the cue.
        await resumeOnce(c);
        if ((c.state as AudioContextState) !== "running") return;
      }
      let voice: Voice | null = null;
      try {
        const notes = cueFor(kind, faces, size);
        while (voices.length >= MAX_VOICES) dropOldest();
        const v: Voice = { oscs: [], live: notes.length };
        voice = v;
        voices.push(v);
        const t0 = c.currentTime;
        for (const n of notes) {
          const osc = c.createOscillator();
          const g = c.createGain();
          const start = t0 + n.at;
          const end = start + n.dur;
          osc.type = n.type ?? "sine";
          osc.frequency.setValueAtTime(n.freq, start);
          if (n.endFreq !== undefined)
            osc.frequency.linearRampToValueAtTime(n.endFreq, end);
          g.gain.setValueAtTime(0, start);
          g.gain.linearRampToValueAtTime(n.gain, start + ATTACK);
          g.gain.linearRampToValueAtTime(0, end);
          osc.connect(g);
          g.connect(m);
          osc.onended = () => {
            if (--v.live <= 0) voices = voices.filter((x) => x !== v);
          };
          v.oscs.push(osc);
          osc.start(start);
          osc.stop(end + 0.01);
        }
      } catch (err) {
        deps.log(err);
        const failed = voice;
        if (failed) {
          voices = voices.filter((x) => x !== failed);
          for (const o of failed.oscs) safe(() => o.stop());
        }
      }
    },
  };
}

export const sound: Sound = createSound();
