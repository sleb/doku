import { readFileSync } from "node:fs";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { idleState } from "../store/game";
import { gameStore } from "../store/gameStore";
import { defaultProgress, progressStore } from "../store/progress";
import { defaultSettings, settingsStore } from "../store/settings";
import { announcerStore } from "../ui/a11y/announcerStore";
import { HOLD_TOTAL_MS } from "../ui/board/hold";
import { STEPS, type TutorialStep } from "./steps";
import { Tutorial } from "./Tutorial";

const BEAT = 600;
const RESET = 900;

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    cb(0);
    return 0;
  });
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  gameStore.setState(idleState, false);
  progressStore.setState(defaultProgress);
  settingsStore.setState({ ...defaultSettings });
  announcerStore.getState().reset();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));

function cellBtn(step: TutorialStep, i: number) {
  const n = step.level.size;
  return screen.getByRole("button", {
    name: new RegExp(`^Row ${Math.floor(i / n) + 1}, column ${(i % n) + 1},`),
  });
}

function holdPointer(el: HTMLElement) {
  fireEvent.pointerDown(el, { button: 0, pointerId: 1 });
  advance(HOLD_TOTAL_MS);
  fireEvent.pointerUp(el, { pointerId: 1 });
}

function holdKey(el: HTMLElement) {
  el.focus();
  fireEvent.keyDown(el, { key: " " });
  advance(HOLD_TOTAL_MS);
  fireEvent.keyUp(el, { key: " " });
}

/** Play one step through the UI, by its goals. */
function play(step: TutorialStep, hold = holdPointer) {
  for (const g of step.goal) {
    const el = cellBtn(step, g.cell);
    if (g.kind === "face" || g.kind === "wrong") {
      if (step.controls?.includes("hint"))
        fireEvent.click(screen.getByRole("button", { name: /^Hint/ }));
      else hold(el);
    } else {
      fireEvent.click(el);
    }
    if (g.kind === "undone")
      fireEvent.click(screen.getByRole("button", { name: "Undo" }));
  }
}

const heading = () => screen.getByRole("heading", { level: 1 });
const status = () => screen.getByRole("status");
const button = (name: string | RegExp) =>
  screen.queryByRole("button", { name });

function toStep(n: number, onDone = vi.fn()) {
  const view = render(<Tutorial onDone={onDone} />);
  for (let i = 0; i < n; i++) {
    play(STEPS[i]);
    advance(BEAT);
  }
  return { ...view, onDone };
}

describe("Tutorial", () => {
  test("opens on step 1 with its card, board and only the mode toggle", () => {
    render(<Tutorial onDone={() => {}} />);
    expect(heading()).toHaveTextContent(STEPS[0].title);
    expect(screen.getByText("Step 1 of 6")).toBeInTheDocument();
    expect(screen.getByRole("grid", { name: "Puzzle board" })).toBeVisible();
    expect(screen.getAllByRole("button", { name: /^Row / })).toHaveLength(16);
    expect(button("Skip tutorial")).toBeInTheDocument();
    expect(button("Tap places faces")).toBeInTheDocument();
    expect(button("Undo")).toBeNull();
    expect(button("Redo")).toBeNull();
    expect(button(/^Hint/)).toBeNull();
    expect(button("Pause")).toBeNull();
    expect(screen.queryByRole("img", { name: /hearts/ })).toBeNull();
  });

  test("pre-placed faces are locked and the goal cells are highlighted", () => {
    render(<Tutorial onDone={() => {}} />);
    const s = STEPS[0];
    const placed = screen.getAllByRole("button", { name: /, face$/ });
    expect(placed).toHaveLength(3);
    for (const p of placed) expect(p).toHaveAttribute("aria-disabled", "true");
    const lit = screen
      .getAllByRole("button", { name: /^Row / })
      .filter((b) => b.dataset.highlight === "true");
    expect(lit.map((b) => Number(b.dataset.index))).toEqual([...s.highlight]);
    expect(
      screen.getByText(/Highlighted: row 4, column 2/),
    ).toBeInTheDocument();
  });

  test("the card names the gesture for the input mode", () => {
    render(<Tutorial onDone={() => {}} />);
    expect(screen.getByText(STEPS[0].how.mark)).toBeInTheDocument();
    act(() => settingsStore.getState().set({ inputMode: "face" }));
    expect(screen.getByText(STEPS[0].how.face)).toBeInTheDocument();
  });

  test("announces each step", () => {
    render(<Tutorial onDone={() => {}} />);
    expect(status()).toHaveTextContent(
      `Step 1 of 6: ${STEPS[0].title}. ${STEPS[0].body}`,
    );
    play(STEPS[0]);
    advance(BEAT);
    expect(status()).toHaveTextContent(
      `Step 2 of 6: ${STEPS[1].title}. ${STEPS[1].body}`,
    );
  });

  test("a pointer hold completes step 1, then the next step follows after a beat", () => {
    render(<Tutorial onDone={() => {}} />);
    holdPointer(cellBtn(STEPS[0], 13));
    expect(cellBtn(STEPS[0], 13)).toHaveAccessibleName(/, face/);
    expect(heading()).toHaveTextContent(STEPS[0].title);
    advance(BEAT - 1);
    expect(heading()).toHaveTextContent(STEPS[0].title);
    advance(1);
    expect(heading()).toHaveTextContent(STEPS[1].title);
    expect(screen.getByText("Step 2 of 6")).toBeInTheDocument();
  });

  test("the board is locked during the beat", () => {
    render(<Tutorial onDone={() => {}} />);
    holdPointer(cellBtn(STEPS[0], 13));
    for (const b of screen.getAllByRole("button", { name: /^Row / }))
      expect(b).toHaveAttribute("aria-disabled", "true");
  });

  test("reduced motion skips the beat", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    render(<Tutorial onDone={() => {}} />);
    holdPointer(cellBtn(STEPS[0], 13));
    advance(0);
    expect(heading()).toHaveTextContent(STEPS[1].title);
  });

  test("a keyboard hold completes a step", () => {
    render(<Tutorial onDone={() => {}} />);
    holdKey(cellBtn(STEPS[0], 13));
    advance(BEAT);
    expect(heading()).toHaveTextContent(STEPS[1].title);
  });

  test("in face mode plain activation completes a step", () => {
    settingsStore.getState().set({ inputMode: "face" });
    render(<Tutorial onDone={() => {}} />);
    fireEvent.click(cellBtn(STEPS[0], 13));
    advance(BEAT);
    expect(heading()).toHaveTextContent(STEPS[1].title);
  });

  test("focus moves to the step heading on a new step", () => {
    render(<Tutorial onDone={() => {}} />);
    play(STEPS[0]);
    advance(BEAT);
    expect(heading()).toHaveFocus();
  });

  test("a step needs all its goals", () => {
    render(<Tutorial onDone={() => {}} />);
    play(STEPS[0]);
    advance(BEAT);
    holdPointer(cellBtn(STEPS[1], 17));
    advance(BEAT);
    expect(heading()).toHaveTextContent(STEPS[1].title);
    holdPointer(cellBtn(STEPS[1], 24));
    advance(BEAT);
    expect(heading()).toHaveTextContent(STEPS[2].title);
  });

  describe("breaking the lesson", () => {
    test("shows onWrong, locks the board, then resets the same step", () => {
      render(<Tutorial onDone={() => {}} />);
      play(STEPS[0]);
      advance(BEAT);
      const s = STEPS[1];
      // Row 4's face belongs in column 3; hold on a different cell instead.
      holdPointer(cellBtn(s, 15));
      expect(screen.getByTestId("on-wrong")).toHaveTextContent(s.onWrong);
      expect(status()).toHaveTextContent(s.onWrong);
      for (const b of screen.getAllByRole("button", { name: /^Row / }))
        expect(b).toHaveAttribute("aria-disabled", "true");
      advance(RESET - 1);
      expect(screen.getByTestId("on-wrong")).toBeInTheDocument();
      advance(1);
      expect(screen.queryByTestId("on-wrong")).toBeNull();
      expect(heading()).toHaveTextContent(s.title);
      expect(cellBtn(s, 15)).toHaveAccessibleName(/, empty/);
      expect(cellBtn(s, 15)).not.toHaveAttribute("aria-disabled");
      expect(status()).toHaveTextContent(`Step 2 of 6: ${s.title}`);
    });

    test("a note on the answer cell breaks the step too", () => {
      render(<Tutorial onDone={() => {}} />);
      play(STEPS[0]);
      advance(BEAT);
      play(STEPS[1]);
      advance(BEAT);
      const s = STEPS[2];
      fireEvent.click(cellBtn(s, 8)); // row 2's face is at column 4
      expect(screen.getByTestId("on-wrong")).toHaveTextContent(s.onWrong);
      advance(RESET);
      expect(cellBtn(s, 8)).toHaveAccessibleName(/, empty/);
    });
  });

  describe("controls appear where the step introduces them", () => {
    test("Undo and Redo only on the notes step", () => {
      toStep(3);
      expect(heading()).toHaveTextContent(STEPS[3].title);
      expect(button("Undo")).toBeInTheDocument();
      expect(button("Redo")).toBeInTheDocument();
      expect(button(/^Hint/)).toBeNull();
    });

    test("notes step: two notes then Undo completes it", () => {
      toStep(3);
      const s = STEPS[3];
      fireEvent.click(cellBtn(s, 1));
      fireEvent.click(cellBtn(s, 6));
      advance(BEAT);
      expect(heading()).toHaveTextContent(s.title);
      fireEvent.click(screen.getByRole("button", { name: "Undo" }));
      advance(BEAT);
      expect(heading()).toHaveTextContent(STEPS[4].title);
    });

    test("the shortcut keys follow the step's controls", () => {
      render(<Tutorial onDone={() => {}} />);
      // Step 1 has no hint: h must not place anything.
      fireEvent.keyDown(window, { key: "h" });
      expect(screen.getAllByRole("button", { name: /, face$/ })).toHaveLength(
        3,
      );
      fireEvent.keyDown(window, { key: "Escape" });
      expect(screen.getByRole("grid")).toBeVisible();
    });

    test("Hint only on the hint step", () => {
      toStep(5);
      expect(heading()).toHaveTextContent(STEPS[5].title);
      expect(button(/^Hint/)).toBeInTheDocument();
      expect(button("Undo")).toBeNull();
    });
  });

  describe("hearts", () => {
    test("shown only on the hearts and hint steps; a wrong tap costs one", () => {
      toStep(4);
      const s = STEPS[4];
      expect(heading()).toHaveTextContent(s.title);
      expect(
        screen.getByRole("img", { name: "3 of 3 hearts" }),
      ).toBeInTheDocument();
      holdPointer(cellBtn(s, 14));
      expect(
        screen.getByRole("img", { name: "2 of 3 hearts" }),
      ).toBeInTheDocument();
      expect(cellBtn(s, 14)).toHaveAccessibleName(/, wrong/);
      // The expected wrong tap is the lesson, not a failure.
      advance(RESET);
      expect(heading()).toHaveTextContent(s.title);
      expect(cellBtn(s, 14)).toHaveAccessibleName(/, wrong/);
      holdPointer(cellBtn(s, 11));
      advance(BEAT);
      expect(heading()).toHaveTextContent(STEPS[5].title);
      expect(
        screen.getByRole("img", { name: "3 of 3 hearts" }),
      ).toBeInTheDocument();
    });

    test("the heart count is not spoken", () => {
      toStep(4);
      holdPointer(cellBtn(STEPS[4], 14));
      expect(status()).not.toHaveTextContent(/hearts? left/);
    });
  });

  describe("finishing", () => {
    test("Skip calls onDone from any step", () => {
      const onDone = vi.fn();
      toStep(2, onDone);
      fireEvent.click(screen.getByRole("button", { name: "Skip tutorial" }));
      expect(onDone).toHaveBeenCalledTimes(1);
    });

    test("the last step has a single Finish button and no Skip", () => {
      const { onDone } = toStep(5);
      expect(button("Skip tutorial")).toBeNull();
      expect(screen.getAllByRole("button", { name: "Finish" })).toHaveLength(1);
      play(STEPS[5]);
      advance(BEAT);
      expect(heading()).toHaveTextContent(STEPS[5].title);
      expect(onDone).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole("button", { name: "Finish" }));
      expect(onDone).toHaveBeenCalledTimes(1);
    });

    test("Skip and Finish are at least 44px", () => {
      render(<Tutorial onDone={() => {}} />);
      expect(button("Skip tutorial")?.className).toMatch(/min-h-11/);
    });
  });

  describe("isolation", () => {
    test("never touches the campaign store, progress or storage", () => {
      const settings = { ...settingsStore.getState() };
      const progress = progressStore.getState();
      const { onDone } = toStep(6);
      fireEvent.click(screen.getByRole("button", { name: "Finish" }));
      expect(onDone).toHaveBeenCalled();
      expect(gameStore.getState().status).toBe("idle");
      expect(progressStore.getState()).toBe(progress);
      expect(settingsStore.getState().seenTutorial).toBe(settings.seenTutorial);
    });

    test("has no clock: time passing does not advance anything", () => {
      render(<Tutorial onDone={() => {}} />);
      advance(60_000);
      expect(screen.queryByTestId("timer")).toBeNull();
      expect(heading()).toHaveTextContent(STEPS[0].title);
    });

    test("the tutorial sources do not import the campaign, progress or storage", () => {
      for (const f of [
        "Tutorial.tsx",
        "TutorialCard.tsx",
        "steps.ts",
        "progress.ts",
      ]) {
        const src = readFileSync(`${__dirname}/${f}`, "utf8");
        expect(src, f).not.toMatch(
          /from "\.\.\/(app\/campaign|levels\/campaign|store\/progress|platform\/storage|store\/persist)"/,
        );
        expect(src, f).not.toMatch(/\{[^}]*\bgameStore\b[^}]*\}/);
      }
    });
  });
});
