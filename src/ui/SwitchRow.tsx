export function SwitchRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between rounded border border-stone-300 px-4 py-2 min-h-11"
    >
      <span>{label}</span>
      <span aria-hidden="true">{checked ? "On" : "Off"}</span>
    </button>
  );
}
