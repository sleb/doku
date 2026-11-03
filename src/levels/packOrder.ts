// Pure and import.meta-free so e2e (plain Node) shares the app's ordering.
const packNumber = (key: string): number =>
  Number(/pack-(\d+)\.json$/.exec(key)?.[1] ?? Number.NaN);

/** Campaign pack order: by the numeric suffix, so pack-2 precedes pack-10. */
export function orderPackKeys(keys: string[]): string[] {
  return [...keys].sort((a, b) => packNumber(a) - packNumber(b));
}
