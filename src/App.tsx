import { LEVELS, levelIndex } from "./levels/campaign";
import { GameScreen } from "./ui/screens/GameScreen";

// Dev-only start override (?level=<id>) for e2e and manual checks; read once
// at module load. M4-07 replaces the default with the player's current level.
const requested = import.meta.env.DEV
  ? levelIndex(new URLSearchParams(window.location.search).get("level") ?? "")
  : -1;
const level = LEVELS[Math.max(requested, 0)];

function App() {
  return (
    // container-type: size is deliberate: it makes main the size container for
    // the layout and the containing block for position:fixed descendants
    // (ResultModal). main's padding box is the full viewport, so the overlay
    // still dims the inset regions; main's padding keeps content inside them.
    <main className="h-dvh safe-padding [container-type:size]">
      <GameScreen level={level} />
    </main>
  );
}

export default App;
