import { demoLevel } from "./levels/demoLevel";
import { REGION_BG, REGION_NAMES } from "./ui/board/palette";

function App() {
  return (
    <main className="mx-auto flex max-w-md flex-col items-center gap-4 p-6">
      <h1 className="text-3xl font-bold">Doku</h1>
      <p className="text-sm text-stone-600">{demoLevel.id}</p>
      {/* Temporary palette strip; removed when Board lands. */}
      <div className="flex gap-1">
        {REGION_NAMES.map((name, i) => (
          <div
            key={name}
            role="presentation"
            aria-label={name}
            className={`h-8 w-8 rounded ${REGION_BG[i]}`}
          />
        ))}
      </div>
    </main>
  );
}

export default App;
