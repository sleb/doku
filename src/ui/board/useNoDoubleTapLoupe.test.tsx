import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { useNoDoubleTapLoupe } from "./useNoDoubleTapLoupe";

function Fixture({ onClick, now }: { onClick: () => void; now: () => number }) {
  const ref = useNoDoubleTapLoupe<HTMLDivElement>(now);
  return (
    <div ref={ref} data-testid="grid">
      <button type="button" onClick={onClick}>
        cell
      </button>
    </div>
  );
}

// jsdom has no Touch constructor; fake the touch lists the hook reads.
function touch(type: string, target: Element) {
  const e = new Event(type, { bubbles: true, cancelable: true });
  const list = [{ clientX: 1, clientY: 1 }];
  Object.assign(e, {
    touches: type === "touchend" ? [] : list,
    changedTouches: list,
  });
  target.dispatchEvent(e);
  return e;
}

function setup() {
  let t = 1000;
  const onClick = vi.fn();
  render(<Fixture onClick={onClick} now={() => t} />);
  const cell = screen.getByRole("button");
  // jsdom has no layout, so hit-testing is stubbed to the cell.
  document.elementFromPoint = () => cell;
  return { cell, onClick, advance: (ms: number) => (t += ms) };
}

describe("useNoDoubleTapLoupe", () => {
  test("a first touch is left alone", () => {
    const { cell } = setup();
    expect(touch("touchstart", cell).defaultPrevented).toBe(false);
  });

  test("a quick second touch is cancelled so iOS shows no loupe", () => {
    const { cell, advance } = setup();
    touch("touchstart", cell);
    touch("touchend", cell);
    advance(100);
    expect(touch("touchstart", cell).defaultPrevented).toBe(true);
  });

  test("a slow second touch is left alone", () => {
    const { cell, advance } = setup();
    touch("touchstart", cell);
    touch("touchend", cell);
    advance(1000);
    expect(touch("touchstart", cell).defaultPrevented).toBe(false);
  });

  test("a cancelled touch replays its tap as a click on release", () => {
    const { cell, onClick, advance } = setup();
    touch("touchstart", cell);
    touch("touchend", cell);
    advance(100);
    touch("touchstart", cell);
    touch("touchend", cell);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  test("a touch released off its cell does not click", () => {
    const { cell, onClick, advance } = setup();
    touch("touchstart", cell);
    touch("touchend", cell);
    advance(100);
    touch("touchstart", cell);
    document.elementFromPoint = () => document.body;
    touch("touchend", cell);
    expect(onClick).not.toHaveBeenCalled();
  });
});
