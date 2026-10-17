import { useEffect, useSyncExternalStore } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CancelError, Events, type CancellablePromise } from "@wailsio/runtime";
import { nanoid } from "nanoid";
import * as AI from "../../bindings/datacia/internal/ai/service";
import { errorMessage } from "@/lib/utils";
import { ChatContext, type ProviderStatus } from "../../bindings/datacia/internal/ai/models";

export type { ProviderStatus };
export { ChatContext };
export { SignIn } from "../../bindings/datacia/internal/ai/service";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  error?: string;
  streaming?: boolean;
}

interface ChatState {
  loaded: boolean;
  provider: string;
  model: string;
  messages: ChatMessage[];
}

export function useAIProviders() {
  const queryClient = useQueryClient();
  useEffect(
    () =>
      Events.On("app:settings-changed", () => {
        queryClient.invalidateQueries({ queryKey: ["ai-providers"] });
      }),
    [queryClient],
  );
  return useQuery({ queryKey: ["ai-providers"], queryFn: () => AI.Providers() });
}

/** Lists models with the given url and key, or the saved ones when empty. */
export function useProviderModels(providerId: string, url: string, key: string, enabled: boolean) {
  return useQuery({
    queryKey: ["ai-models", providerId, url, key],
    queryFn: () => AI.ListModels(providerId, url, key),
    enabled,
    // Don't keep typed, unsaved keys around in the cache.
    gcTime: key ? 0 : undefined,
    staleTime: 10 * 60_000,
    retry: false,
  });
}

let state: ChatState = { loaded: false, provider: "", model: "", messages: [] };
const listeners = new Set<() => void>();
let pending: { id: string; call: CancellablePromise<string> } | null = null;

function set(next: Partial<ChatState>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

function patchMessage(id: string, patch: Partial<ChatMessage>) {
  set({ messages: state.messages.map((m) => (m.id === id ? { ...m, ...patch } : m)) });
}

// Saves run one at a time so an older snapshot can't overwrite a newer one.
let saving = Promise.resolve();
function persist() {
  const messages = state.messages
    .filter((m) => !m.streaming)
    .map(({ id, role, content, error }) => ({ id, role, content, error: error ?? "" }));
  const chat = { provider: state.provider, model: state.model, messages };
  saving = saving.then(() => AI.SaveChat(chat)).catch(() => {});
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

let loading: Promise<void> | null = null;
function load() {
  if (loading) return;
  loading = AI.LoadChat()
    .then((chat) =>
      set({
        loaded: true,
        provider: chat.provider,
        model: chat.model,
        messages: chat.messages.map((m) => ({
          id: m.id,
          role: m.role === "user" ? "user" : "assistant",
          content: m.content,
          error: m.error || undefined,
        })),
      }),
    )
    .catch(() => set({ loaded: true }));
}

export function useChat() {
  useEffect(() => load(), []);
  return useSyncExternalStore(subscribe, () => state);
}

// Streamed text arrives as events; apply it at most once per frame.
let buffered = "";
let frame = 0;
Events.On("ai:delta", (ev) => {
  if (!pending || ev.data.id !== pending.id) return;
  buffered += ev.data.text;
  frame ||= requestAnimationFrame(() => {
    frame = 0;
    const msg = pending && state.messages.find((m) => m.id === pending!.id);
    if (msg) patchMessage(msg.id, { content: msg.content + buffered });
    buffered = "";
  });
});

/** History for the model: completed turns only, skipping exchanges that failed. */
function history(messages: ChatMessage[]) {
  const out: { role: string; content: string }[] = [];
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    const reply = messages[i + 1];
    if (m.role === "user" && reply?.role === "assistant" && (reply.error || !reply.content)) {
      i++;
      continue;
    }
    if (!m.error && m.content) out.push({ role: m.role, content: m.content });
  }
  return out;
}

async function run(context: ChatContext) {
  const reply: ChatMessage = { id: nanoid(), role: "assistant", content: "", streaming: true };
  const messages = history(state.messages);
  set({ messages: [...state.messages, reply] });

  const call = AI.Chat({ id: reply.id, provider: state.provider, model: state.model, messages, context });
  pending = { id: reply.id, call };
  try {
    const text = await call;
    patchMessage(reply.id, { content: text, streaming: false });
  } catch (err) {
    if (err instanceof CancelError) {
      const partial = (state.messages.find((m) => m.id === reply.id)?.content ?? "") + buffered;
      patchMessage(reply.id, partial ? { content: partial, streaming: false } : { streaming: false, error: "Stopped." });
    } else {
      patchMessage(reply.id, { streaming: false, error: errorMessage(err) || "Something went wrong." });
    }
  } finally {
    if (pending?.id === reply.id) pending = null;
    cancelAnimationFrame(frame);
    frame = 0;
    buffered = "";
    persist();
  }
}

export const chat = {
  send(text: string, context: ChatContext) {
    const content = text.trim();
    if (!content || pending || !state.model) return;
    set({ messages: [...state.messages, { id: nanoid(), role: "user", content }] });
    void run(context);
  },
  retry(context: ChatContext) {
    const last = state.messages.at(-1);
    if (pending || last?.role !== "assistant" || !last.error) return;
    set({ messages: state.messages.slice(0, -1) });
    void run(context);
  },
  stop() {
    pending?.call.cancel();
  },
  clear() {
    pending?.call.cancel();
    set({ messages: [] });
    persist();
  },
  selectModel(provider: string, model: string) {
    set({ provider, model });
    persist();
  },
};
