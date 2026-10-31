export function Hearts({
  remaining,
  max,
}: {
  remaining: number;
  max: number;
}) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: a group of decorative svgs exposed as one image
    <div role="img" aria-label={`${remaining} of ${max} hearts`}>
      {Array.from({ length: max }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length, order-stable list
        <HeartIcon key={i} filled={i < remaining} />
      ))}
    </div>
  );
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      data-filled={filled}
      className={`inline-block size-6 stroke-2 transition-[transform,fill] duration-200 ${
        filled
          ? "fill-current stroke-red-500 text-red-500"
          : "scale-90 fill-none stroke-stone-400"
      }`}
    >
      <path d="M12 21s-8-5.2-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.8-8 11-8 11z" />
    </svg>
  );
}
