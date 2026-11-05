import { type Board, Cell, type Level } from "../engine";
import type { Control } from "../ui/screens/ActionBar";

/** An action that, with the rest of a step's goals, completes the step. */
export interface Goal {
  cell: number;
  /**
   * face: the correct face is placed. mark: a ✕ note stands. wrong: a wrong
   * tap landed here (the lesson of the hearts step). undone: this is one of
   * the step's note cells, and the last note placed was taken back with Undo,
   * whichever order they were marked in.
   */
  kind: "face" | "mark" | "wrong" | "undone";
}

export interface TutorialStep {
  id: string;
  title: string;
  /** One or two short sentences. */
  body: string;
  /** The gesture to use, by input mode. */
  how: { mark: string; face: string };
  /** 4x4 to 6x6, hand-built; never in the campaign. */
  level: Level;
  /** Pre-placed (locked) faces. */
  start: Board;
  goal: readonly Goal[];
  /** Cells to ring: the "look here" cue. */
  highlight: readonly number[];
  /** Action buttons and shortcuts available, cumulative from the step that introduces them. */
  controls?: readonly Control[];
  /** Show the (display-only) hearts. */
  showHearts?: boolean;
  /** Shown when the player breaks the lesson; the step then resets. */
  onWrong: string;
}

function level(n: number, solution: number[], regions: number[][]): Level {
  return { id: `tutorial-${n}`, size: regions.length, regions, solution };
}

function start(size: number, faces: number[]): Board {
  const b = new Uint8Array(size * size);
  for (const f of faces) b[f] = Cell.Face;
  return b;
}

const MARK_IN_FACE_MODE =
  "Turn off Tap places faces, then tap the highlighted cell, or press X on it.";

export const STEPS: readonly TutorialStep[] = [
  {
    id: "region",
    title: "One face per region",
    body: "Each colored region holds exactly one face. Two regions are done; place the face in the highlighted cell of the next one.",
    how: {
      mark: "Press and hold the highlighted cell until it fills. On a keyboard, hold Space on it.",
      face: "Tap the highlighted cell. On a keyboard, press Space on it.",
    },
    level: level(
      1,
      [2, 0, 3, 1],
      [
        [0, 0, 0, 0],
        [1, 1, 0, 0],
        [3, 3, 2, 2],
        [3, 3, 3, 2],
      ],
    ),
    start: start(4, [2, 4]),
    goal: [{ cell: 13, kind: "face" }],
    highlight: [13],
    onWrong:
      "That cell is not the one. The last row's face goes in the highlighted cell.",
  },
  {
    id: "lines",
    title: "Rows and columns",
    body: "Each row and each column holds exactly one face too. Rows 1 and 2 are done. Rows 4 and 5 each have one cell left that is free of faces in its column and row: place those.",
    how: {
      mark: "Press and hold each highlighted cell until it fills.",
      face: "Tap each highlighted cell.",
    },
    level: level(
      2,
      [1, 3, 0, 2, 4],
      [
        [0, 0, 1, 1, 1],
        [2, 0, 1, 1, 1],
        [2, 2, 3, 3, 3],
        [2, 2, 3, 3, 3],
        [2, 2, 3, 3, 4],
      ],
    ),
    start: start(5, [1, 8]),
    goal: [
      { cell: 17, kind: "face" },
      { cell: 24, kind: "face" },
    ],
    highlight: [17, 24],
    onWrong:
      "Not there. Use the highlighted cells: they are the only ones left in their rows and columns.",
  },
  {
    id: "touching",
    title: "No touching",
    body: "Faces never touch, not even corners. The face in the top corner rules out the highlighted cell diagonally below it. Mark it with a ✕.",
    how: {
      mark: "Tap the highlighted cell to mark it with a ✕.",
      face: MARK_IN_FACE_MODE,
    },
    level: level(
      3,
      [0, 3, 1, 4, 2],
      [
        [0, 0, 1, 1, 1],
        [4, 2, 1, 1, 1],
        [4, 2, 2, 1, 1],
        [4, 4, 4, 4, 3],
        [4, 4, 4, 4, 3],
      ],
    ),
    start: start(5, [0]),
    goal: [{ cell: 6, kind: "mark" }],
    highlight: [6],
    onWrong:
      "That cell can hold a face, so it should not be crossed out. Mark the highlighted one.",
  },
  {
    id: "notes",
    title: "Notes and undo",
    body: "A ✕ is only a note, so you can change your mind. Mark the two highlighted cells, then press Undo to take back the last one.",
    how: {
      mark: "Tap the first highlighted cell, then the second, then press Undo.",
      face: `${MARK_IN_FACE_MODE} Then press Undo, or Z.`,
    },
    level: level(
      4,
      [0, 2, 4, 1, 3],
      [
        [0, 1, 1, 2, 2],
        [1, 1, 1, 2, 2],
        [3, 3, 1, 2, 2],
        [3, 3, 4, 4, 4],
        [3, 3, 4, 4, 4],
      ],
    ),
    start: start(5, []),
    goal: [
      { cell: 1, kind: "mark" },
      { cell: 6, kind: "undone" },
    ],
    highlight: [1, 6],
    controls: ["undo", "redo"],
    onWrong:
      "That cell holds a face, so it should not be crossed out. Use the highlighted cells.",
  },
  {
    id: "hearts",
    title: "Hearts",
    body: "A wrong face costs a heart and shows a red ✕, and that cell is then locked. Place a face in the first highlighted cell to see it, then the right one in the second.",
    how: {
      mark: "Press and hold each highlighted cell, the first one first.",
      face: "Tap each highlighted cell, the first one first.",
    },
    level: level(
      5,
      [0, 3, 1, 4, 2],
      [
        [0, 2, 2, 1, 1],
        [2, 2, 2, 1, 1],
        [2, 2, 4, 3, 3],
        [2, 4, 4, 3, 3],
        [4, 4, 4, 3, 3],
      ],
    ),
    start: start(5, [0, 8]),
    goal: [
      { cell: 14, kind: "wrong" },
      { cell: 11, kind: "face" },
    ],
    highlight: [14, 11],
    controls: ["undo", "redo"],
    showHearts: true,
    onWrong:
      "Only the first highlighted cell is wrong on purpose. Try that one, then the second.",
  },
  {
    id: "hint",
    title: "Hints",
    body: "Stuck? Hint places one correct face for a heart. Press it now.",
    how: {
      mark: "Press the Hint button, or H.",
      face: "Press the Hint button, or H.",
    },
    level: level(
      6,
      [5, 3, 0, 2, 4, 1],
      [
        [2, 1, 1, 1, 1, 0],
        [2, 2, 1, 1, 1, 1],
        [2, 2, 2, 1, 4, 4],
        [2, 5, 3, 1, 4, 4],
        [5, 5, 5, 1, 4, 4],
        [5, 5, 5, 5, 4, 4],
      ],
    ),
    start: start(6, [5, 9]),
    goal: [{ cell: 12, kind: "face" }],
    highlight: [12],
    controls: ["undo", "redo", "hint"],
    showHearts: true,
    onWrong: "Use the Hint button for this one.",
  },
];
