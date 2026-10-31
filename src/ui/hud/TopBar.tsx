import type { Level } from "../../engine";
import { MAX_HEARTS } from "../../store/game";
import { Hearts } from "./Hearts";

export function TopBar({ level, hearts }: { level: Level; hearts: number }) {
  return (
    <header className="flex items-center justify-between">
      <h1 className="text-lg font-semibold">{level.id}</h1>
      <Hearts remaining={hearts} max={MAX_HEARTS} />
    </header>
  );
}
