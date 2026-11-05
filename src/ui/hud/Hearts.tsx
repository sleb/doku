import { useLayoutEffect, useRef } from "react";
import { useStore } from "zustand";
import { fxStore } from "../fx/fxStore";

export function Hearts({ remaining, max }: { remaining: number; max: number }) {
  // Narrow selector: only Hearts re-renders on an outcome, and only when the popped index changes.
  const popped = useStore(fxStore, (s) =>
    s.last && (s.last.kind === "wrong" || s.last.kind === "lose")
      ? s.last
      : null,
  );
  return (
    <div role="img" aria-label={`${remaining} of ${max} hearts`}>
      {Array.from({ length: max }, (_, i) => (
        <HeartIcon
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length list, index is identity
          key={i}
          filled={i < remaining}
          pop={popped?.hearts === i}
          seq={popped?.seq}
        />
      ))}
    </div>
  );
}

function HeartIcon({
  filled,
  pop,
  seq,
}: {
  filled: boolean;
  pop: boolean;
  seq?: number;
}) {
  // The svg keeps a stable identity so the fill transition runs; a repeat pop
  // restarts its CSS animation in place.
  const ref = useRef<SVGSVGElement>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: seq is the restart trigger
  useLayoutEffect(() => {
    if (!pop) return;
    for (const a of ref.current?.getAnimations?.() ?? []) {
      a.cancel();
      a.play();
    }
  }, [pop, seq]);
  return (
    <svg
      ref={ref}
      viewBox="0 0 24 24"
      aria-hidden="true"
      data-filled={filled}
      data-pop={pop ? "true" : undefined}
      className={`inline-block size-6 stroke-2 transition-[scale,fill,stroke] duration-200 motion-reduce:transition-none ${
        filled
          ? "fill-current stroke-red-500 text-red-500"
          : "scale-90 fill-transparent stroke-stone-400"
      }`}
    >
      <path d="M12 21s-8-5.2-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.8-8 11-8 11z" />
    </svg>
  );
}
