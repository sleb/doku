import { describe, expect, it, vi } from "vitest";
import { createSound } from "./sound";

class FakeParam {
  value = 0;
  calls: [string, number, number?][] = [];
  setValueAtTime(v: number, t: number) {
    this.calls.push(["set", v, t]);
  }
  linearRampToValueAtTime(v: number, t: number) {
    this.calls.push(["ramp", v, t]);
  }
}
class FakeNode {
  connected: FakeNode | undefined;
  connect(n: FakeNode) {
    this.connected = n;
  }
}
class FakeGain extends FakeNode {
  gain = new FakeParam();
}
class FakeOsc extends FakeNode {
  type = "sine";
  frequency = new FakeParam();
  started: number | undefined;
  stops: (number | undefined)[] = [];
  onended: (() => void) | null = null;
  start(t: number) {
    this.started = t;
  }
  stop(t?: number) {
    this.stops.push(t);
  }
  end() {
    this.onended?.();
  }
}
class FakeCtx {
  currentTime = 1;
  destination = new FakeNode();
  state = "suspended";
  gains: FakeGain[] = [];
  oscs: FakeOsc[] = [];
  resume = vi.fn().mockResolvedValue(undefined);
  suspend = vi.fn().mockResolvedValue(undefined);
  createGain() {
    const g = new FakeGain();
    this.gains.push(g);
    return g;
  }
  createOscillator() {
    const o = new FakeOsc();
    this.oscs.push(o);
    return o;
  }
}

function setup(create?: () => unknown) {
  const ctx = new FakeCtx();
  const createContext = vi.fn(create ?? (() => ctx));
  const log = vi.fn();
  // biome-ignore lint/suspicious/noExplicitAny: test fake
  const s = createSound({ createContext: createContext as any, log });
  return { ctx, createContext, log, s };
}

describe("unlock", () => {
  it("creates the context lazily, once, and resumes it", () => {
    const { ctx, createContext, s } = setup();
    expect(createContext).not.toHaveBeenCalled();
    s.unlock();
    s.unlock();
    expect(createContext).toHaveBeenCalledTimes(1);
    expect(ctx.resume).toHaveBeenCalled();
  });

  it("master gain is 0.18 into the destination", () => {
    const { ctx, s } = setup();
    s.unlock();
    expect(ctx.gains[0].gain.value).toBe(0.18);
    expect(ctx.gains[0].connected).toBe(ctx.destination);
  });
});

describe("play", () => {
  it("is a silent no-op before unlock", async () => {
    const { ctx, createContext, s } = setup();
    await s.play("place", 1, 7);
    expect(createContext).not.toHaveBeenCalled();
    expect(ctx.oscs).toHaveLength(0);
  });

  it("schedules one oscillator per note with a ramp to 0", async () => {
    const { ctx, s } = setup();
    s.unlock();
    await s.play("win", 1, 7);
    expect(ctx.oscs).toHaveLength(4);
    expect(ctx.gains).toHaveLength(5); // master + one per note
    for (const g of ctx.gains.slice(1)) {
      const last = g.gain.calls[g.gain.calls.length - 1];
      expect(last?.[0]).toBe("ramp");
      expect(last?.[1]).toBe(0);
    }
    expect(ctx.oscs[1].started).toBeCloseTo(1.09);
    expect(ctx.oscs[0].stops).toHaveLength(1);
  });

  it("attacks over at least 5 ms", async () => {
    const { ctx, s } = setup();
    s.unlock();
    await s.play("place", 1, 7);
    const [, attack] = ctx.gains[1].gain.calls;
    expect(attack[0]).toBe("ramp");
    expect((attack[2] as number) - 1).toBeCloseTo(0.005, 6);
  });

  it("glides wrong notes", async () => {
    const { ctx, s } = setup();
    s.unlock();
    await s.play("wrong", 1, 7);
    const f = ctx.oscs[0].frequency.calls;
    expect(f[f.length - 1]?.[0]).toBe("ramp");
    expect(ctx.oscs[0].type).toBe("triangle");
  });

  it("stops the oldest voice when a fifth starts", async () => {
    const { ctx, s } = setup();
    s.unlock();
    for (let i = 0; i < 4; i++) await s.play("place", 1, 7);
    expect(ctx.oscs.every((o) => o.stops.length === 1)).toBe(true);
    await s.play("place", 1, 7);
    expect(ctx.oscs[0].stops).toHaveLength(2);
    expect(ctx.oscs[1].stops).toHaveLength(1);
  });

  it("frees a voice when its last oscillator ends", async () => {
    const { ctx, s } = setup();
    s.unlock();
    for (let i = 0; i < 4; i++) await s.play("place", 1, 7);
    ctx.oscs[0].end();
    await s.play("place", 1, 7);
    expect(ctx.oscs[0].stops).toHaveLength(1); // not force-stopped
    expect(ctx.oscs[1].stops).toHaveLength(1);
  });

  it("frees a multi-note voice only after the last note ends", async () => {
    const { ctx, s } = setup();
    s.unlock();
    await s.play("win", 1, 7); // oscs 0-3
    for (let i = 0; i < 3; i++) await s.play("place", 1, 7); // 4 voices
    for (const o of ctx.oscs.slice(0, 3)) o.end();
    await s.play("place", 1, 7); // still full: win voice not done
    expect(ctx.oscs[3].stops).toHaveLength(2); // whole win voice dropped
    expect(ctx.oscs[0].stops).toHaveLength(2);
  });
});

describe("suspend and resume", () => {
  it("do nothing before unlock", () => {
    const { ctx, s } = setup();
    s.suspend();
    s.resume();
    expect(ctx.suspend).not.toHaveBeenCalled();
    expect(ctx.resume).not.toHaveBeenCalled();
  });

  it("forward once unlocked", () => {
    const { ctx, s } = setup();
    s.unlock();
    ctx.resume.mockClear();
    s.suspend();
    s.resume();
    expect(ctx.suspend).toHaveBeenCalledTimes(1);
    expect(ctx.resume).toHaveBeenCalledTimes(1);
  });
});

describe("failures", () => {
  it("logs a null context and never retries", async () => {
    const { createContext, s } = setup(() => null);
    s.unlock();
    s.unlock();
    await expect(s.play("place", 1, 7)).resolves.toBeUndefined();
    expect(createContext).toHaveBeenCalledTimes(1);
  });

  it("logs a throwing createContext and never retries", async () => {
    const boom = new Error("boom");
    const { createContext, log, s } = setup(() => {
      throw boom;
    });
    s.unlock();
    s.unlock();
    await s.play("place", 1, 7);
    expect(log).toHaveBeenCalledWith(boom);
    expect(createContext).toHaveBeenCalledTimes(1);
  });

  it("logs a throwing oscillator and still resolves", async () => {
    const { ctx, log, s } = setup();
    s.unlock();
    ctx.createOscillator = () => {
      throw new Error("osc");
    };
    await expect(s.play("place", 1, 7)).resolves.toBeUndefined();
    expect(log).toHaveBeenCalled();
  });

  it("logs a rejecting resume", async () => {
    const { ctx, log, s } = setup();
    ctx.resume.mockRejectedValue(new Error("nope"));
    s.unlock();
    await Promise.resolve();
    await Promise.resolve();
    expect(log).toHaveBeenCalled();
  });
});
