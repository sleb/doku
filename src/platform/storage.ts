export interface Storage {
  /** Resolves `undefined` when missing or unreadable; does not validate. */
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown): Promise<void>;
  remove(key: string): Promise<void>;
  /** Force pending writes to durable storage. */
  flush(): Promise<void>;
}

export class MemoryStorage implements Storage {
  private data = new Map<string, string>();

  async get<T>(key: string): Promise<T | undefined> {
    const raw = this.data.get(key);
    return raw === undefined ? undefined : (JSON.parse(raw) as T);
  }
  async set(key: string, value: unknown): Promise<void> {
    this.data.set(key, JSON.stringify(value));
  }
  async remove(key: string): Promise<void> {
    this.data.delete(key);
  }
  async flush(): Promise<void> {}
}

const PREFIX = "doku:";

export class LocalStorageStorage implements Storage {
  constructor(
    private area: () => globalThis.Storage,
    private log: (err: unknown) => void,
  ) {}

  /** Runs `fn`, logging and swallowing any failure (incl. the global throwing). */
  private attempt<R>(fn: (area: globalThis.Storage) => R): R | undefined {
    try {
      return fn(this.area());
    } catch (err) {
      this.log(err);
      return undefined;
    }
  }

  async get<T>(key: string): Promise<T | undefined> {
    return this.attempt((area) => {
      const raw = area.getItem(PREFIX + key);
      return raw === null ? undefined : (JSON.parse(raw) as T);
    });
  }
  async set(key: string, value: unknown): Promise<void> {
    this.attempt((area) => area.setItem(PREFIX + key, JSON.stringify(value)));
  }
  async remove(key: string): Promise<void> {
    this.attempt((area) => area.removeItem(PREFIX + key));
  }
  async flush(): Promise<void> {}
}

/** The slice of `@tauri-apps/plugin-store`'s `Store` we use. */
export interface StoreLike {
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<boolean>;
  save(): Promise<void>;
}

/** Relies on the plugin's debounced autosave for `set`; `flush` saves now. */
export class TauriStorage implements Storage {
  constructor(
    private store: StoreLike,
    private log: (err: unknown) => void,
  ) {}

  private async attempt<R>(fn: (s: StoreLike) => Promise<R>) {
    try {
      return await fn(this.store);
    } catch (err) {
      this.log(err);
      return undefined;
    }
  }

  get<T>(key: string): Promise<T | undefined> {
    return this.attempt((s) => s.get<T>(key));
  }
  async set(key: string, value: unknown): Promise<void> {
    await this.attempt((s) => s.set(key, value));
  }
  async remove(key: string): Promise<void> {
    await this.attempt((s) => s.delete(key));
  }
  async flush(): Promise<void> {
    await this.attempt((s) => s.save());
  }
}

export interface StorageDeps {
  isTauri(): boolean;
  loadTauri(path: string): Promise<StoreLike>;
  localStorage(): globalThis.Storage;
  /** Receives swallowed failures. */
  log(err: unknown): void;
}

export const STORE_FILE = "doku.json";

const defaultDeps: StorageDeps = {
  isTauri: () =>
    typeof window !== "undefined" && "__TAURI_INTERNALS__" in window,
  loadTauri: async (path) =>
    (await import("@tauri-apps/plugin-store")).load(path),
  localStorage: () => globalThis.localStorage,
  log: (err) => {
    if (import.meta.env.DEV) console.debug("storage:", err);
  },
};

/**
 * Picks the adapter. Under Tauri the store loads lazily on first use; if that
 * fails the browser fallback is used for the rest of the session, so data is
 * never split across adapters.
 */
export function createStorage(deps: StorageDeps = defaultDeps): Storage {
  const fallback = (): Storage => {
    try {
      deps.localStorage();
    } catch (err) {
      deps.log(err);
      return new MemoryStorage();
    }
    return new LocalStorageStorage(deps.localStorage, deps.log);
  };

  let backend: Promise<Storage> | undefined;
  const resolve = () => {
    backend ??= deps.isTauri()
      ? deps.loadTauri(STORE_FILE).then(
          (store) => new TauriStorage(store, deps.log) as Storage,
          (err) => {
            deps.log(err);
            return fallback();
          },
        )
      : Promise.resolve(fallback());
    return backend;
  };

  return {
    get: async (key) => (await resolve()).get(key),
    set: async (key, value) => (await resolve()).set(key, value),
    remove: async (key) => (await resolve()).remove(key),
    flush: async () => (await resolve()).flush(),
  };
}

export const storage: Storage = createStorage();
