import { startOver } from "./app/campaign";
import { LEVELS } from "./levels/campaign";
import { useGameStore } from "./store/gameStore";
import { useProgressStore } from "./store/progress";
import { Finale } from "./ui/screens/Finale";
import { GameScreen } from "./ui/screens/GameScreen";

function App() {
  const finished = useProgressStore((s) => s.next === LEVELS.length);
  // Idle too: the last win's result modal (Finish) must show before the Finale.
  const idle = useGameStore((s) => s.status === "idle");
  return (
    // container-type: size is deliberate: it makes main the size container for
    // the layout and the containing block for position:fixed descendants
    // (ResultModal). main's padding box is the full viewport, so the overlay
    // still dims the inset regions; main's padding keeps content inside them.
    <main className="h-dvh safe-padding [container-type:size]">
      {finished && idle ? <Finale onStartOver={startOver} /> : <GameScreen />}
    </main>
  );
}

export default App;
