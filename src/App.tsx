import { demoLevel, demoLevel11 } from "./levels/demoLevel";
import { GameScreen } from "./ui/screens/GameScreen";

// Temporary level picker for e2e and manual checks; M4 level select replaces it.
// Dev/test only (e2e runs against the dev server); read once at module load.
const level =
  import.meta.env.DEV &&
  new URLSearchParams(window.location.search).get("level") === demoLevel11.id
    ? demoLevel11
    : demoLevel;

function App() {
  return (
    // container-type: size makes main the containing block for position:fixed
    // descendants (ResultModal); revisit in M3-02 safe-area work.
    <main className="h-dvh [container-type:size]">
      <GameScreen level={level} />
    </main>
  );
}

export default App;
