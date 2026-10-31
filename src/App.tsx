import { demoLevel } from "./levels/demoLevel";
import { GameScreen } from "./ui/screens/GameScreen";

function App() {
  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 p-6">
      <GameScreen level={demoLevel} />
    </main>
  );
}

export default App;
