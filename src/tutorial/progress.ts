import { Cell } from "../engine";
import type { GameState } from "../store/game";
import type { TutorialStep } from "./steps";

export type StepProgress = "progress" | "complete" | "broken";

/**
 * Where a step stands on the private store's state. Broken means the player
 * broke the lesson: a wrong tap the step did not ask for, or a note on the
 * answer cell. Pure.
 */
export function evaluate(step: TutorialStep, state: GameState): StepProgress {
  if (state.status === "idle") return "progress";
  const { board, wrong, future } = state;
  const { size, solution } = step.level;
  const expectedWrong = new Set(
    step.goal.filter((g) => g.kind === "wrong").map((g) => g.cell),
  );
  for (const cell of wrong) if (!expectedWrong.has(cell)) return "broken";
  for (let r = 0; r < size; r++) {
    const cell = r * size + solution[r];
    if (board[cell] === Cell.Mark && !wrong.has(cell)) return "broken";
  }
  const met = (g: TutorialStep["goal"][number]) => {
    switch (g.kind) {
      case "face":
        return board[g.cell] === Cell.Face;
      case "mark":
        return board[g.cell] === Cell.Mark && !wrong.has(g.cell);
      case "wrong":
        return wrong.has(g.cell);
      case "undone":
        return board[g.cell] === Cell.Empty && future.includes(g.cell);
    }
  };
  return step.goal.every(met) ? "complete" : "progress";
}
