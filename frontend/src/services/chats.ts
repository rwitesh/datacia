import { useSyncExternalStore } from "react";
import { CancelError, Events, type CancellablePromise } from "@wailsio/runtime";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";
import * as AI from "./bindings/ai";
import { errorMessage } from "@/lib/utils";
import type { ChatContext, ToolUse } from "./bindings/ai";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  error?: string;
  /** What the model read to answer, in call order. */
  tools?: ToolUse[];
  streaming?: boolean;
}

/** An open chat tab. A new chat is saved with its first reply. */
export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  /** False while a saved chat is read from disk. */
  loaded: boolean;
}

interface ChatsState {
  open: Conversation[];
  activeId: string;
}

const TITLE_CHARS = 80;

function emptyChat(): Conversation {
  return { id: uuidv4(), title: "", messages: [], loaded: true };
}

const first = emptyChat();
let state: ChatsState = { open: [first], activeId: first.id };
const listeners = new Set<() => void>();

// The request answering each chat, and the chat each reply belongs to.
const pending = new Map<string, { replyId: string; call: CancellablePromise<string> }>();
const replyChat = new Map<string, string>();

function set(next: Partial<ChatsState>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function find(chatId: string) {
  return state.open.find((c) => c.id === chatId);
}

function patchChat(chatId: string, patch: (c: Conversation) => Partial<Conversation>) {
  set({ open: state.open.map((c) => (c.id === chatId ? { ...c, ...patch(c) } : c)) });
}

function patchMessage(chatId: string, messageId: string, patch: (m: ChatMessage) => Partial<ChatMessage>) {
  patchChat(chatId, (c) => ({ messages: c.messages.map((m) => (m.id === messageId ? { ...m, ...patch(m) } : m)) }));
}

// Saves of one chat run in order so an older snapshot can't overwrite a newer one.
const saving = new Map<string, Promise<void>>();
function persist(chatId: string) {
  const chat = find(chatId);
  if (!chat || chat.messages.length === 0) return;
  const messages = chat.messages
    .filter((m) => !m.streaming)
    .map(({ id, role, content, error, tools }) => ({ id, role, content, error: error ?? "", tools }));
  const save = (saving.get(chatId) ?? Promise.resolve())
    .then(() => AI.SaveChat({ id: chat.id, title: chat.title, messages }))
    .catch((err) => {
      toast.error("Couldn't save the chat", { description: errorMessage(err) });
    });
  saving.set(chatId, save);
}

// Streamed text arrives as events; apply it at most once per frame.
const buffered = new Map<string, string>();
let frame = 0;
function flush() {
  frame = 0;
  for (const [replyId, text] of buffered) {
    const chatId = replyChat.get(replyId);
    if (chatId) patchMessage(chatId, replyId, (m) => ({ content: m.content + text }));
  }
  buffered.clear();
}

Events.On("ai:delta", (ev) => {
  if (!replyChat.has(ev.data.id)) return;
  buffered.set(ev.data.id, (buffered.get(ev.data.id) ?? "") + ev.data.text);
  frame ||= requestAnimationFrame(flush);
});

// A tool is reported as it starts and again when it ends, with the same ID.
Events.On("ai:tool", (ev) => {
  const chatId = replyChat.get(ev.data.id);
  const tool: ToolUse = ev.data.tool;
  if (!chatId) return;
  patchMessage(chatId, ev.data.id, (m) => {
    const tools = m.tools ?? [];
    return tools.some((t) => t.id === tool.id)
      ? { tools: tools.map((t) => (t.id === tool.id ? tool : t)) }
      : { tools: [...tools, tool] };
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

async function run(chatId: string, context: ChatContext) {
  const chat = find(chatId);
  if (!chat) return;
  const reply: ChatMessage = { id: uuidv4(), role: "assistant", content: "", streaming: true };
  const messages = history(chat.messages);
  patchChat(chatId, (c) => ({ messages: [...c.messages, reply] }));

  const call = AI.Chat({ id: reply.id, messages, context });
  pending.set(chatId, { replyId: reply.id, call });
  replyChat.set(reply.id, chatId);
  try {
    const text = await call;
    patchMessage(chatId, reply.id, () => ({ content: text, streaming: false }));
  } catch (err) {
    if (err instanceof CancelError) {
      const rest = buffered.get(reply.id) ?? "";
      patchMessage(chatId, reply.id, (m) =>
        m.content + rest ? { content: m.content + rest, streaming: false } : { streaming: false, error: "Stopped." },
      );
    } else {
      patchMessage(chatId, reply.id, () => ({ streaming: false, error: errorMessage(err) || "Something went wrong." }));
    }
  } finally {
    pending.delete(chatId);
    replyChat.delete(reply.id);
    buffered.delete(reply.id);
    persist(chatId);
  }
}

export function useChats() {
  return useSyncExternalStore(subscribe, () => state);
}

export function useActiveChat() {
  const { open, activeId } = useChats();
  return open.find((c) => c.id === activeId) ?? open[0];
}

export const chats = {
  send(chatId: string, text: string, context: ChatContext) {
    const content = text.trim();
    if (!content || pending.has(chatId)) return;
    patchChat(chatId, (c) => ({
      title: c.title || content.split("\n")[0].slice(0, TITLE_CHARS),
      messages: [...c.messages, { id: uuidv4(), role: "user", content }],
    }));
    void run(chatId, context);
  },
  retry(chatId: string, context: ChatContext) {
    const last = find(chatId)?.messages.at(-1);
    if (pending.has(chatId) || last?.role !== "assistant" || !last.error) return;
    patchChat(chatId, (c) => ({ messages: c.messages.slice(0, -1) }));
    void run(chatId, context);
  },
  stop(chatId: string) {
    pending.get(chatId)?.call.cancel();
  },
  activate(chatId: string) {
    if (find(chatId)) set({ activeId: chatId });
  },
  /** Opens an empty chat, reusing one that is already open. */
  create() {
    const empty = state.open.find((c) => c.loaded && c.messages.length === 0);
    if (empty) return set({ activeId: empty.id });
    const chat = emptyChat();
    set({ open: [...state.open, chat], activeId: chat.id });
  },
  /** Opens a saved chat in a tab, or shows it if it is open already. */
  async open(chatId: string) {
    if (find(chatId)) return set({ activeId: chatId });
    set({ open: [...state.open, { id: chatId, title: "", messages: [], loaded: false }], activeId: chatId });
    try {
      const saved = await AI.LoadChat(chatId);
      patchChat(chatId, () => ({
        title: saved.title,
        loaded: true,
        messages: saved.messages.map((m) => ({
          id: m.id,
          role: m.role === "user" ? "user" : "assistant",
          content: m.content,
          error: m.error || undefined,
          tools: m.tools,
        })),
      }));
    } catch (err) {
      toast.error("Couldn't open the chat", { description: errorMessage(err) });
      chats.close(chatId);
    }
  },
  /** Closes a tab, stopping its reply. The last tab is replaced by an empty chat. */
  close(chatId: string) {
    pending.get(chatId)?.call.cancel();
    const index = state.open.findIndex((c) => c.id === chatId);
    if (index === -1) return;
    const open = state.open.filter((c) => c.id !== chatId);
    if (open.length === 0) open.push(emptyChat());
    const activeId = state.activeId === chatId ? open[Math.min(index, open.length - 1)].id : state.activeId;
    set({ open, activeId });
  },
  /** Deletes a saved chat and closes its tab. */
  async remove(chatId: string) {
    // A closed chat isn't saved again; wait for a save already under way.
    chats.close(chatId);
    await saving.get(chatId);
    await AI.DeleteChat(chatId);
  },
};
