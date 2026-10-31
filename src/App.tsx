import { demoLevel, demoLevel11 } from "./levels/demoLevel";
import { GameScreen } from "./ui/screens/GameScreen";

// Temporary level picker for e2e and manual checks; M4 level select replaces it.
function pickLevel() {
  const id = new URLSearchParams(window.location.search).get("level");
  return id === demoLevel11.id ? demoLevel11 : demoLevel;
}

function App() {
  return (
    <main className="h-dvh [container-type:size]">
      <GameScreen level={pickLevel()} />
    </main>
  );
}

export default App;
