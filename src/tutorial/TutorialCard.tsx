import type { ReactNode, Ref } from "react";
import type { TutorialStep } from "./steps";

const where = (cell: number, size: number) =>
  `row ${Math.floor(cell / size) + 1}, column ${(cell % size) + 1}`;

/** The step's title, copy, gesture and Skip/Finish. Presentational. */
export function TutorialCard({
  step,
  index,
  total,
  inputMode,
  broken,
  slip,
  hearts,
  onDone,
  headingRef,
}: {
  step: TutorialStep;
  index: number;
  total: number;
  inputMode: "mark" | "face";
  /** True while the player's slip is being explained: shows `onWrong`. */
  broken: boolean;
  /** True while a stray ✕ stands where a face goes: points at the gesture. */
  slip?: boolean;
  hearts?: ReactNode;
  onDone: () => void;
  headingRef?: Ref<HTMLHeadingElement>;
}) {
  const last = index === total - 1;
  const cells = step.highlight.map((c) => where(c, step.level.size)).join("; ");
  return (
    <section
      aria-label="Tutorial"
      data-testid="tutorial-card"
      className="flex flex-col gap-1 text-sm"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-ink-muted">{`Step ${index + 1} of ${total}`}</p>
        {hearts}
        <button
          type="button"
          onClick={onDone}
          className="min-h-11 min-w-11 rounded border border-line px-3"
        >
          {last ? "Finish" : "Skip tutorial"}
        </button>
      </div>
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="text-lg font-semibold outline-none"
      >
        {step.title}
      </h1>
      <p>{step.body}</p>
      <p className="text-ink-muted">{step.how[inputMode]}</p>
      <p className="text-ink-muted">{`Highlighted: ${cells}.`}</p>
      {slip && !broken && (
        <p data-testid="gesture-hint" className="font-semibold">
          {`That made a ✕ note, not a face. ${step.how[inputMode]}`}
        </p>
      )}
      {broken && (
        <p data-testid="on-wrong" className="font-semibold">
          {step.onWrong}
        </p>
      )}
    </section>
  );
}
