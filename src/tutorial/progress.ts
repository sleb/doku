import { Cell } from "../engine";
import type { GameState } from "../store/game";
import type { TutorialStep } from "./steps";

/** Cells where the solution has a face. */
function solutionCells(step: TutorialStep): number[] {
  const { size, solution } = step.level;
  return solution.map((c, r) => r * size + c);
}

/**
 * A step that asks for faces: a ✕ on a solution cell there is a slip of the
 * gesture (a plain tap in mark mode), not the lesson's mistake.
 */
const asksForFaces = (step: TutorialStep) =>
  step.goal.some((g) => g.kind === "face");

/** True while a stray ✕ stands on a solution cell of a step that asks for faces. */
export function gestureSlip(step: TutorialStep, state: GameState): boolean {
  if (state.status === "idle" || !asksForFaces(step)) return false;
  const { board, wrong } = state;
  return solutionCells(step).some(
    (c) => board[c] === Cell.Mark && !wrong.has(c),
  );
}

export type StepProgress = "progress" | "complete" | "broken";

/**
 * Where a step stands on the private store's state. Broken means the player
 * broke the lesson: a wrong tap the step did not ask for, or a note on the
 * answer cell. Pure.
 */
export function evaluate(step: TutorialStep, state: GameState): StepProgress {
  if (state.status === "idle") return "progress";
  const { board, wrong, future } = state;
  const expectedWrong = new Set(
    step.goal.filter((g) => g.kind === "wrong").map((g) => g.cell),
  );
  for (const cell of wrong) if (!expectedWrong.has(cell)) return "broken";
  if (!asksForFaces(step))
    for (const cell of solutionCells(step))
      if (board[cell] === Cell.Mark && !wrong.has(cell)) return "broken";
  // Note cells of an Undo lesson: all stand, except exactly one, taken back.
  const noteCells = step.goal
    .filter((g) => g.kind === "mark" || g.kind === "undone")
    .map((g) => g.cell);
  const hasUndo = step.goal.some((g) => g.kind === "undone");
  const undoneNow = noteCells.filter(
    (c) => board[c] === Cell.Empty && future.includes(c),
  ).length;
  const met = (g: TutorialStep["goal"][number]) => {
    switch (g.kind) {
      case "face":
        return board[g.cell] === Cell.Face;
      case "mark":
        // In an Undo lesson the "undone" goal judges every note cell.
        return hasUndo || (board[g.cell] === Cell.Mark && !wrong.has(g.cell));
      case "wrong":
        return wrong.has(g.cell);
      case "undone":
        return (
          undoneNow === 1 &&
          noteCells.every(
            (c) =>
              (board[c] === Cell.Mark && !wrong.has(c)) ||
              (board[c] === Cell.Empty && future.includes(c)),
          )
        );
    }
  };
  return step.goal.every(met) ? "complete" : "progress";
}
