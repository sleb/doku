import { startCurrent } from "./campaign";

/**
 * Runs `boot`, then `render`. A rejected boot is logged, not swallowed, and the
 * app still renders from default state (the current level, started fresh).
 */
export async function launch(
  boot: () => Promise<void>,
  render: () => void,
): Promise<void> {
  try {
    await boot();
  } catch (error) {
    console.error("Boot failed; starting with default state", error);
    startCurrent();
  }
  render();
}
