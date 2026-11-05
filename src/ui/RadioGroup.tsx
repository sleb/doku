import { useRef } from "react";

/** A radiogroup of styled buttons with a roving tabindex and arrow-key selection. */
export function RadioGroup<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly (readonly [T, string])[];
  onChange: (next: T) => void;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const checked = options.findIndex(([v]) => v === value);
  const tabbable = checked < 0 ? 0 : checked;

  function move(to: number) {
    const i = (to + options.length) % options.length;
    refs.current[i]?.focus();
    onChange(options[i][0]);
  }

  function onKeyDown(e: React.KeyboardEvent, i: number) {
    const next: Record<string, number> = {
      ArrowRight: i + 1,
      ArrowDown: i + 1,
      ArrowLeft: i - 1,
      ArrowUp: i - 1,
      Home: 0,
      End: options.length - 1,
    };
    if (e.key in next) {
      e.preventDefault();
      move(next[e.key]);
    }
  }

  return (
    <div role="radiogroup" aria-label={label} className="flex flex-col gap-1">
      <span className="text-sm">{label}</span>
      <div className="flex gap-2">
        {options.map(([v, text], i) => (
          // biome-ignore lint/a11y/useSemanticElements: styled button radio
          <button
            key={v}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={value === v}
            tabIndex={i === tabbable ? 0 : -1}
            onClick={() => onChange(v)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={`flex-1 rounded border px-3 py-2 min-h-11 ${
              value === v
                ? "border-accent bg-accent text-on-accent"
                : "border-line"
            }`}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}
