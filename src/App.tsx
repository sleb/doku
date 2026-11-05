import { useState } from "react";
import { startOver } from "./app/campaign";
import { LEVELS } from "./levels/campaign";
import { gameStore, useGameStore } from "./store/gameStore";
import { useProgressStore } from "./store/progress";
import { settingsStore, useSettingsStore } from "./store/settings";
import { Tutorial } from "./tutorial/Tutorial";
import { Finale } from "./ui/screens/Finale";
import { GameScreen } from "./ui/screens/GameScreen";

function App() {
  const finished = useProgressStore((s) => s.next === LEVELS.length);
  // Idle too: the last win's result modal (Finish) must show before the Finale.
  const idle = useGameStore((s) => s.status === "idle");
  const seenTutorial = useSettingsStore((s) => s.seenTutorial);
  const [replaying, setReplaying] = useState(false);
  // The tutorial replaces the game screen while it shows, so no clock, save or
  // shortcut of the campaign runs under it. Leaving it (Skip or Finish) pauses
  // the campaign level first, so it comes back paused with Resume; a replay
  // starts from the Pause dialog, so that pause is a no-op.
  const leaveTutorial = () => {
    gameStore.getState().pause();
    settingsStore.getState().set({ seenTutorial: true });
    setReplaying(false);
  };
  return (
    // container-type: size is deliberate: it makes main the size container for
    // the layout and the containing block for position:fixed descendants
    // (ResultModal). main's padding box is the full viewport, so the overlay
    // still dims the inset regions; main's padding keeps content inside them.
    <main className="h-dvh safe-padding [container-type:size]">
      {replaying || !seenTutorial ? (
        <Tutorial onDone={leaveTutorial} />
      ) : finished && idle ? (
        <Finale onStartOver={startOver} />
      ) : (
        <GameScreen onReplayTutorial={() => setReplaying(true)} />
      )}
    </main>
  );
}

export default App;
