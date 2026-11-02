// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createStorage,
  LocalStorageStorage,
  MemoryStorage,
  type StoreLike,
  storage,
  TauriStorage,
} from "./storage";
import { runStorageContract } from "./storage.contract";

runStorageContract("MemoryStorage", () => new MemoryStorage());

describe("LocalStorageStorage", () => {
  beforeEach(() => localStorage.clear());

  runStorageContract(
    "LocalStorageStorage",
    () => new LocalStorageStorage(() => localStorage, vi.fn()),
  );

  it("prefixes keys with doku: and leaves other keys alone", async () => {
    localStorage.setItem("other", "keep");
    const s = new LocalStorageStorage(() => localStorage, vi.fn());
    await s.set("k", 1);
    await s.remove("k");
    await s.set("k2", 2);
    expect(localStorage.getItem("doku:k2")).toBe("2");
    expect(localStorage.getItem("doku:k")).toBeNull();
    expect(localStorage.getItem("other")).toBe("keep");
  });

  it("returns undefined and logs once for corrupt JSON", async () => {
    const log = vi.fn();
    localStorage.setItem("doku:bad", "{nope");
    const s = new LocalStorageStorage(() => localStorage, log);
    expect(await s.get("bad")).toBeUndefined();
    expect(log).toHaveBeenCalledTimes(1);
  });
});

describe("LocalStorageStorage failures", () => {
  const boom = () => new Error("boom");
  const quota = () => new DOMException("full", "QuotaExceededError");

  function broken(over: Partial<Record<keyof globalThis.Storage, unknown>>) {
    return {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
      ...over,
    } as unknown as globalThis.Storage;
  }

  async function allResolve(s: LocalStorageStorage) {
    await expect(s.set("k", 1)).resolves.toBeUndefined();
    await expect(s.get("k")).resolves.toBeUndefined();
    await expect(s.remove("k")).resolves.toBeUndefined();
    await expect(s.flush()).resolves.toBeUndefined();
  }

  it("swallows getItem throwing", async () => {
    const log = vi.fn();
    const s = new LocalStorageStorage(
      () =>
        broken({
          getItem: () => {
            throw boom();
          },
        }),
      log,
    );
    await allResolve(s);
    expect(log).toHaveBeenCalled();
  });

  it("swallows setItem throwing, including quota errors", async () => {
    const log = vi.fn();
    const s = new LocalStorageStorage(
      () =>
        broken({
          setItem: () => {
            throw quota();
          },
        }),
      log,
    );
    await allResolve(s);
    expect(log).toHaveBeenCalled();
  });

  it("swallows removeItem throwing", async () => {
    const log = vi.fn();
    const s = new LocalStorageStorage(
      () =>
        broken({
          removeItem: () => {
            throw boom();
          },
        }),
      log,
    );
    await allResolve(s);
    expect(log).toHaveBeenCalled();
  });

  it("swallows the localStorage global itself throwing", async () => {
    const log = vi.fn();
    const s = new LocalStorageStorage(() => {
      throw new DOMException("denied", "SecurityError");
    }, log);
    await allResolve(s);
    expect(log).toHaveBeenCalled();
  });
});

function fakeStore() {
  const data = new Map<string, unknown>();
  return {
    data,
    get: vi.fn(async (k: string) =>
      structuredClone(data.get(k)),
    ) as StoreLike["get"],
    set: vi.fn(async (k: string, v: unknown) => {
      data.set(k, structuredClone(v));
    }),
    delete: vi.fn(async (k: string) => data.delete(k)),
    save: vi.fn(async () => {}),
  };
}

describe("TauriStorage", () => {
  runStorageContract(
    "TauriStorage",
    () => new TauriStorage(fakeStore(), vi.fn()),
  );

  it("delegates to the store and flush really saves", async () => {
    const store = fakeStore();
    const s = new TauriStorage(store, vi.fn());
    await s.set("k", { a: 1 });
    expect(store.set).toHaveBeenCalledWith("k", { a: 1 });
    await s.remove("k");
    expect(store.delete).toHaveBeenCalledWith("k");
    await s.flush();
    expect(store.save).toHaveBeenCalledTimes(1);
  });

  it("logs and swallows a rejecting store", async () => {
    const log = vi.fn();
    const err = new Error("ipc");
    const store = {
      get: vi.fn().mockRejectedValue(err),
      set: vi.fn().mockRejectedValue(err),
      delete: vi.fn().mockRejectedValue(err),
      save: vi.fn().mockRejectedValue(err),
    };
    const s = new TauriStorage(store, log);
    await expect(s.get("k")).resolves.toBeUndefined();
    await expect(s.set("k", 1)).resolves.toBeUndefined();
    await expect(s.remove("k")).resolves.toBeUndefined();
    await expect(s.flush()).resolves.toBeUndefined();
    expect(log).toHaveBeenCalledTimes(4);
  });
});

describe("createStorage", () => {
  beforeEach(() => localStorage.clear());

  const base = {
    isTauri: () => false,
    loadTauri: vi.fn(),
    localStorage: () => localStorage,
    log: vi.fn(),
  };

  it("uses localStorage outside Tauri without loading the plugin", async () => {
    const loadTauri = vi.fn();
    const s = createStorage({ ...base, loadTauri });
    await s.set("k", 1);
    expect(localStorage.getItem("doku:k")).toBe("1");
    expect(loadTauri).not.toHaveBeenCalled();
  });

  it("uses one lazily loaded doku.json store under Tauri", async () => {
    const store = fakeStore();
    const loadTauri = vi.fn(async () => store);
    const s = createStorage({ ...base, isTauri: () => true, loadTauri });
    expect(loadTauri).not.toHaveBeenCalled();
    await s.set("k", 1);
    await s.get("k");
    await s.flush();
    expect(loadTauri).toHaveBeenCalledTimes(1);
    expect(loadTauri).toHaveBeenCalledWith("doku.json");
    expect(store.set).toHaveBeenCalledWith("k", 1);
    expect(store.save).toHaveBeenCalled();
    expect(localStorage.length).toBe(0);
  });

  it("falls back to localStorage for the whole session if the load fails", async () => {
    const log = vi.fn();
    const loadTauri = vi.fn().mockRejectedValue(new Error("no plugin"));
    const s = createStorage({
      ...base,
      isTauri: () => true,
      loadTauri,
      log,
    });
    await s.set("a", 1);
    await s.set("b", 2);
    expect(await s.get("a")).toBe(1);
    expect(localStorage.getItem("doku:b")).toBe("2");
    expect(loadTauri).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalled();
  });

  it("uses memory when localStorage is unavailable", async () => {
    const s = createStorage({
      ...base,
      localStorage: () => {
        throw new DOMException("denied", "SecurityError");
      },
    });
    await s.set("k", 1);
    expect(await s.get("k")).toBe(1);
  });

  it("memory fallback also applies when the Tauri load fails", async () => {
    const s = createStorage({
      ...base,
      isTauri: () => true,
      loadTauri: vi.fn().mockRejectedValue(new Error("x")),
      localStorage: () => {
        throw new Error("denied");
      },
    });
    await s.set("k", 1);
    expect(await s.get("k")).toBe(1);
  });

  it("the default storage works in jsdom", async () => {
    await storage.set("k", { a: 1 });
    expect(await storage.get("k")).toEqual({ a: 1 });
    expect(localStorage.getItem("doku:k")).toBe('{"a":1}');
  });
});
