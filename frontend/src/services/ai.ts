import { useEffect, useSyncExternalStore } from "react";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { CancelError, Events, type CancellablePromise } from "@wailsio/runtime";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";
import * as AI from "./bindings/ai";
import { errorMessage } from "@/lib/utils";
import type { ChatContext, ModelRef, ProviderStatus, ToolUse } from "./bindings/ai";
import { queryKeys } from "./queryKeys";

export type { ChatContext, ModelRef, ProviderStatus, ToolUse };
export { SignIn } from "./bindings/ai";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  error?: string;
  /** What the model read to answer, in call order. */
  tools?: ToolUse[];
  streaming?: boolean;
}

interface ChatState {
  loaded: boolean;
  messages: ChatMessage[];
}

export function useAIProviders() {
  const queryClient = useQueryClient();
  useEffect(
    () =>
      Events.On("app:settings-changed", () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.ai });
      }),
    [queryClient],
  );
  return useQuery({ queryKey: queryKeys.aiProviders, queryFn: () => AI.Providers() });
}

/** Model lists for the given providers. The backend caches them too. */
export function useModelLists(providerIds: string[], enabled: (id: string) => boolean) {
  return useQueries({
    queries: providerIds.map((id) => ({
      queryKey: queryKeys.aiModels(id),
      queryFn: () => AI.ListModels(id),
      enabled: enabled(id),
      staleTime: 10 * 60_000,
      retry: false,
    })),
  });
}

export function useDefaultModel() {
  return useQuery({ queryKey: queryKeys.aiDefaultModel, queryFn: () => AI.DefaultModel() });
}

export function useSetDefaultModel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (model: ModelRef) => AI.SetDefaultModel(model),
    onMutate: (model) => queryClient.setQueryData(queryKeys.aiDefaultModel, model),
    // On success the settings-changed event refreshes it.
    onError: (err) => {
      toast.error(errorMessage(err));
      queryClient.invalidateQueries({ queryKey: queryKeys.aiDefaultModel });
    },
  });
}

let state: ChatState = { loaded: false, messages: [] };
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
    .map(({ id, role, content, error, tools }) => ({ id, role, content, error: error ?? "", tools }));
  saving = saving.then(() => AI.SaveChat({ messages })).catch(() => {});
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

let loadStarted = false;
function load() {
  if (loadStarted) return;
  loadStarted = true;
  AI.LoadChat()
    .then((chat) =>
      set({
        loaded: true,
        messages: chat.messages.map((m) => ({
          id: m.id,
          role: m.role === "user" ? "user" : "assistant",
          content: m.content,
          error: m.error || undefined,
          tools: m.tools,
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

Events.On("ai:tool", (ev) => {
  const msg = pending && state.messages.find((m) => m.id === pending!.id);
  if (msg && ev.data.id === msg.id) patchMessage(msg.id, { tools: [...(msg.tools ?? []), ev.data.tool] });
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
  const reply: ChatMessage = { id: uuidv4(), role: "assistant", content: "", streaming: true };
  const messages = history(state.messages);
  set({ messages: [...state.messages, reply] });

  const call = AI.Chat({ id: reply.id, messages, context });
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
    if (!content || pending) return;
    set({ messages: [...state.messages, { id: uuidv4(), role: "user", content }] });
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
};
