import { describe, expect, it } from "vitest";
import { cueFor } from "./cues";

const place = (faces: number, size = 7) => cueFor("place", faces, size);

describe("cueFor place", () => {
  it("is one short sine blip", () => {
    const notes = place(1);
    expect(notes).toHaveLength(1);
    expect(notes[0].dur).toBeCloseTo(0.07);
    expect(notes[0].type ?? "sine").toBe("sine");
  });

  it.each([5, 7, 11])("rises strictly with faces on size %i", (size) => {
    const freqs = Array.from(
      { length: size },
      (_, i) => place(i + 1, size)[0].freq,
    );
    for (let i = 1; i < freqs.length; i++)
      expect(freqs[i]).toBeGreaterThan(freqs[i - 1]);
  });

  it("clamps out-of-range faces", () => {
    expect(place(0)[0].freq).toBe(place(1)[0].freq);
    expect(place(99)[0].freq).toBe(place(7)[0].freq);
  });
});

describe("cueFor wrong", () => {
  const [w] = cueFor("wrong", 3, 7);
  it("is a low downward-gliding triangle", () => {
    expect(cueFor("wrong", 3, 7)).toHaveLength(1);
    expect(w.type).toBe("triangle");
    expect(w.dur).toBeCloseTo(0.18);
    expect(w.endFreq).toBeLessThan(w.freq);
  });
  it("sits below every place note and is no louder", () => {
    const lowest = place(1)[0];
    expect(w.freq).toBeLessThan(lowest.freq);
    expect(w.gain).toBeLessThanOrEqual(lowest.gain);
  });
});

describe("cueFor win and lose", () => {
  const end = (ns: ReturnType<typeof cueFor>) =>
    Math.max(...ns.map((n) => n.at + n.dur));
  const win = cueFor("win", 1, 5);
  const lose = cueFor("lose", 1, 5);

  it("win is a four-note rising arpeggio ending an octave up", () => {
    expect(win).toHaveLength(4);
    for (let i = 1; i < 4; i++) {
      expect(win[i].freq).toBeGreaterThan(win[i - 1].freq);
      expect(win[i].at).toBeCloseTo(win[i - 1].at + 0.09);
    }
    expect(win[3].freq / win[0].freq).toBeCloseTo(2);
  });

  it("lose falls and is shorter than win", () => {
    expect(lose).toHaveLength(2);
    expect(lose[1].freq).toBeLessThan(lose[0].freq);
    expect(end(lose)).toBeLessThan(end(win));
  });

  it("do not depend on faces or size", () => {
    expect(cueFor("win", 9, 11)).toEqual(win);
    expect(cueFor("lose", 9, 11)).toEqual(lose);
  });
});
