/// <reference types="node" />
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

// Test-only colour-vision-deficiency tooling: Machado 2009 (severity 1.0)
// simulation in linear RGB, then sRGB -> Lab and CIEDE2000.
type Vec = [number, number, number];
type Mat = [Vec, Vec, Vec];

const SIMULATIONS: Record<string, Mat> = {
  protanopia: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deuteranopia: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  tritanopia: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.3039],
  ],
};

function toLinear(hex: string): Vec {
  return [1, 3, 5].map((o) => {
    const c = Number.parseInt(hex.slice(o, o + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as Vec;
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

function simulate(lin: Vec, m: Mat): Vec {
  return m.map((row) =>
    clamp01(row[0] * lin[0] + row[1] * lin[1] + row[2] * lin[2]),
  ) as Vec;
}

function linearToLab([r, g, b]: Vec): Vec {
  const x = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047;
  const y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
  const z = (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883;
  const f = (t: number) =>
    t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116;
  const [fx, fy, fz] = [f(x), f(y), f(z)];
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

function deltaE2000([L1, a1, b1]: Vec, [L2, a2, b2]: Vec): number {
  const C1 = Math.hypot(a1, b1);
  const C2 = Math.hypot(a2, b2);
  const Cb = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7)));
  const ap1 = (1 + G) * a1;
  const ap2 = (1 + G) * a2;
  const Cp1 = Math.hypot(ap1, b1);
  const Cp2 = Math.hypot(ap2, b2);
  const hp = (b: number, a: number) =>
    b === 0 && a === 0 ? 0 : (deg(Math.atan2(b, a)) + 360) % 360;
  const hp1 = hp(b1, ap1);
  const hp2 = hp(b2, ap2);
  const dLp = L2 - L1;
  const dCp = Cp2 - Cp1;
  let dhp = 0;
  if (Cp1 * Cp2 !== 0) {
    dhp = hp2 - hp1;
    if (dhp > 180) dhp -= 360;
    else if (dhp < -180) dhp += 360;
  }
  const dHp = 2 * Math.sqrt(Cp1 * Cp2) * Math.sin(rad(dhp / 2));
  const Lbp = (L1 + L2) / 2;
  const Cbp = (Cp1 + Cp2) / 2;
  let hbp = hp1 + hp2;
  if (Cp1 * Cp2 !== 0) {
    if (Math.abs(hp1 - hp2) > 180) hbp += hp1 + hp2 < 360 ? 360 : -360;
    hbp /= 2;
  }
  const T =
    1 -
    0.17 * Math.cos(rad(hbp - 30)) +
    0.24 * Math.cos(rad(2 * hbp)) +
    0.32 * Math.cos(rad(3 * hbp + 6)) -
    0.2 * Math.cos(rad(4 * hbp - 63));
  const dTheta = 30 * Math.exp(-(((hbp - 275) / 25) ** 2));
  const Rc = 2 * Math.sqrt(Cbp ** 7 / (Cbp ** 7 + 25 ** 7));
  const Sl = 1 + (0.015 * (Lbp - 50) ** 2) / Math.sqrt(20 + (Lbp - 50) ** 2);
  const Sc = 1 + 0.045 * Cbp;
  const Sh = 1 + 0.015 * Cbp * T;
  const Rt = -Math.sin(rad(2 * dTheta)) * Rc;
  return Math.sqrt(
    (dLp / Sl) ** 2 +
      (dCp / Sc) ** 2 +
      (dHp / Sh) ** 2 +
      Rt * (dCp / Sc) * (dHp / Sh),
  );
}

const css = readFileSync(
  new URL("../../app/index.css", import.meta.url),
  "utf8",
);

function tokenHex(prefix: string, i: number): string {
  const m = css.match(
    new RegExp(`--color-${prefix}-${i}:\\s*(#[0-9a-fA-F]{6})`),
  );
  if (!m) throw new Error(`--color-${prefix}-${i} missing`);
  return m[1];
}

function minDeltaE(prefix: string, sim: Mat | null): number {
  const labs = Array.from({ length: 11 }, (_, i) => {
    const lin = toLinear(tokenHex(prefix, i));
    return linearToLab(sim ? simulate(lin, sim) : lin);
  });
  let min = Number.POSITIVE_INFINITY;
  for (let i = 0; i < 11; i++)
    for (let j = i + 1; j < 11; j++)
      min = Math.min(min, deltaE2000(labs[i], labs[j]));
  return min;
}

describe("colour-vision helpers", () => {
  test("white and black convert to Lab extremes", () => {
    const [L, a, b] = linearToLab([1, 1, 1]);
    expect(L).toBeCloseTo(100, 1);
    expect(a).toBeCloseTo(0, 1);
    expect(b).toBeCloseTo(0, 1);
    expect(linearToLab([0, 0, 0])[0]).toBeCloseTo(0, 3);
  });

  test("CIEDE2000 matches Sharma's reference pairs", () => {
    expect(deltaE2000([50, 2.6772, -79.7751], [50, 0, -82.7485])).toBeCloseTo(
      2.0425,
      3,
    );
    expect(deltaE2000([50, 2.5, 0], [50, 0, -2.5])).toBeCloseTo(4.3065, 3);
    expect(deltaE2000([50, 2.5, 0], [50, 2.5, 0])).toBe(0);
  });

  test("simulations keep greys grey and collapse red from green", () => {
    for (const m of Object.values(SIMULATIONS)) {
      const g = simulate(toLinear("#808080"), m);
      expect(g[0]).toBeCloseTo(g[1], 2);
      expect(g[1]).toBeCloseTo(g[2], 2);
    }
    const [red, green] = ["#c0392b", "#6b8e23"].map((h) =>
      linearToLab(simulate(toLinear(h), SIMULATIONS.deuteranopia)),
    );
    expect(deltaE2000(red, green)).toBeLessThan(
      deltaE2000(
        linearToLab(toLinear("#c0392b")),
        linearToLab(toLinear("#6b8e23")),
      ),
    );
  });
});

// Recorded after tuning, with a margin below the measured minimum over all 55
// pairs (measured: protanopia 13.44, deuteranopia 13.24, tritanopia 13.32).
// Patterns can be off, so colour alone must separate the regions.
// For reference only (not asserted): the default palette's minimum is 14.0
// under normal vision but 1.58 under deuteranopia, which is why the accessible
// palette exists.
const FLOORS: Record<string, number> = {
  protanopia: 12.5,
  deuteranopia: 12.5,
  tritanopia: 12.5,
};

describe("accessible palette under simulated colour-vision deficiency", () => {
  for (const [name, m] of Object.entries(SIMULATIONS)) {
    test(`${name}: every pair stays at least ${FLOORS[name]} apart (CIEDE2000)`, () => {
      expect(minDeltaE("region-a", m)).toBeGreaterThanOrEqual(FLOORS[name]);
    });
  }
});
