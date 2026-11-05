import type { CSSProperties } from "react";

// One decoration per region index (POLISH_DESIGN 8.4); region 0 stays solid.
export const PATTERN_NAMES = [
  "solid",
  "dots",
  "horizontal lines",
  "vertical lines",
  "diagonal /",
  "diagonal \\",
  "grid",
  "crosshatch",
  "checker",
  "zigzag",
  "rings",
] as const;

// Stroke alpha: low enough that the glyph stays the highest-contrast thing.
export const PATTERN_OPACITY = 0.25;

const STROKE = `fill='none' stroke='#000' stroke-width='1.5' opacity='${PATTERN_OPACITY}'`;
const FILL = `fill='#000' opacity='${PATTERN_OPACITY}'`;

// Shapes in a 12x12 tile; diagonals overshoot so the tiles join seamlessly.
const SHAPES: (string | null)[] = [
  null,
  `<circle cx='6' cy='6' r='1.8' ${FILL}/>`,
  `<path d='M0 6H12' ${STROKE}/>`,
  `<path d='M6 0V12' ${STROKE}/>`,
  `<path d='M-3 3L3 -3M0 12L12 0M9 15L15 9' ${STROKE}/>`,
  `<path d='M-3 9L3 15M0 0L12 12M9 -3L15 3' ${STROKE}/>`,
  `<path d='M0 6H12M6 0V12' ${STROKE}/>`,
  `<path d='M-3 3L3 -3M0 12L12 0M9 15L15 9M-3 9L3 15M0 0L12 12M9 -3L15 3' ${STROKE}/>`,
  `<path d='M0 0H6V6H0ZM6 6H12V12H6Z' ${FILL}/>`,
  `<path d='M0 9L3 3L6 9L9 3L12 9' ${STROKE}/>`,
  `<circle cx='6' cy='6' r='3.5' ${STROKE}/>`,
];

function build(shape: string | null): CSSProperties {
  if (shape === null) return {};
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12'>${shape}</svg>`;
  return {
    backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(svg)}")`,
    // Tiles scale with the board.
    backgroundSize: "calc(var(--cell) / 4) calc(var(--cell) / 4)",
  };
}

// Module constants, so a cell's style prop keeps its identity across renders.
const STYLES = SHAPES.map(build);

export function patternStyle(region: number): CSSProperties {
  return STYLES[region];
}
