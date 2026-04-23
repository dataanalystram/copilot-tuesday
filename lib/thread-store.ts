/**
 * Local thread store — persists chat history + dashboard snapshots across
 * reloads when the CopilotKit Intelligence platform isn't wired up.
 *
 * `useThreads` in @copilotkit/react-core@1.56.2 talks to the hosted
 * Intelligence runtime (WebSocket + platform auth). A self-hosted local LLM
 * deployment won't have that, so this file gives us a graceful fallback
 * backed by localStorage. The ThreadSwitcher component prefers platform
 * threads when present, and falls back to this store otherwise.
 *
 * The store is intentionally tiny and serializable — no indexes, no
 * migrations. If we outgrow it we swap the backend to IndexedDB.
 */

const STORAGE_KEY = "morphboard.threads.v1";

export interface LocalMessage {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  createdAt: string;
}

export interface LocalThread {
  id: string;
  name: string | null;
  createdAt: string;
  updatedAt: string;
  subject?: string;
  messageCount: number;
  surfaces?: unknown[]; // AgentSharedState.surfaces snapshot
  state?: unknown;      // Full AgentSharedState snapshot
  messages?: LocalMessage[];
}

type Store = { version: 1; threads: LocalThread[] };

function emptyStore(): Store {
  return { version: 1, threads: [] };
}

function read(): Store {
  if (typeof window === "undefined") return emptyStore();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyStore();
    const parsed = JSON.parse(raw) as Store;
    if (!parsed || parsed.version !== 1) return emptyStore();
    return parsed;
  } catch {
    return emptyStore();
  }
}

function write(s: Store): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    // Notify same-tab listeners — storage events only fire cross-tab.
    window.dispatchEvent(new Event("morphboard:threads"));
  } catch {
    /* localStorage disabled — no-op */
  }
}

export const threadStore = {
  list(): LocalThread[] {
    return read().threads.slice().sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  },

  get(id: string): LocalThread | undefined {
    return read().threads.find((t) => t.id === id);
  },

  upsert(thread: LocalThread): void {
    const s = read();
    const i = s.threads.findIndex((t) => t.id === thread.id);
    if (i >= 0) s.threads[i] = thread;
    else s.threads.unshift(thread);
    write(s);
  },

  rename(id: string, name: string): void {
    const s = read();
    const t = s.threads.find((x) => x.id === id);
    if (!t) return;
    t.name = name;
    t.updatedAt = new Date().toISOString();
    write(s);
  },

  delete(id: string): void {
    const s = read();
    s.threads = s.threads.filter((t) => t.id !== id);
    write(s);
  },

  clear(): void {
    write(emptyStore());
  },

  subscribe(cb: () => void): () => void {
    if (typeof window === "undefined") return () => {};
    const handler = () => cb();
    window.addEventListener("morphboard:threads", handler);
    window.addEventListener("storage", (e) => {
      if (e.key === STORAGE_KEY) handler();
    });
    return () => {
      window.removeEventListener("morphboard:threads", handler);
    };
  },
};

export function makeThreadId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `th_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Build a short, human-readable name from the first user message.
 * Returns null when there is no good candidate.
 */
export function autoNameFromMessages(messages: { role: string; content: string }[]): string | null {
  const firstUser = messages.find((m) => m.role === "user" && m.content.trim().length > 0);
  if (!firstUser) return null;
  const cleaned = firstUser.content.replace(/\s+/g, " ").trim();
  if (!cleaned) return null;
  return cleaned.length > 48 ? cleaned.slice(0, 46) + "…" : cleaned;
}
