import { GLYPH_COLOR, WRONG_COLOR } from "./palette";

type Kind = "face" | "mark" | "wrong";

function Svg({
  kind,
  color,
  children,
}: {
  kind: Kind;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <svg
      aria-hidden="true"
      data-icon={kind}
      viewBox="0 0 24 24"
      className="h-3/5 w-3/5"
      fill="none"
      stroke={color}
      strokeWidth={2.5}
      strokeLinecap="round"
    >
      {children}
    </svg>
  );
}

export function FaceIcon() {
  return (
    <Svg kind="face" color={GLYPH_COLOR}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="9" cy="10" r="0.5" />
      <circle cx="15" cy="10" r="0.5" />
      <path d="M8 15c2.5 2.5 5.5 2.5 8 0" />
    </Svg>
  );
}

const CROSS = <path d="M6 6l12 12M18 6L6 18" />;

export function MarkIcon() {
  return (
    <Svg kind="mark" color={GLYPH_COLOR}>
      {CROSS}
    </Svg>
  );
}

export function WrongIcon() {
  return (
    <Svg kind="wrong" color={WRONG_COLOR}>
      {CROSS}
    </Svg>
  );
}
