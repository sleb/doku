import { demoLevel } from "./levels/demoLevel";
import { GameScreen } from "./ui/screens/GameScreen";

function App() {
  return (
    <main className="mx-auto flex w-fit max-w-full flex-col gap-4 px-4 py-6">
      <GameScreen level={demoLevel} />
    </main>
  );
}

export default App;
