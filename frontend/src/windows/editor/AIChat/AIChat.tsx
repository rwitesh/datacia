import { Fragment, useCallback, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, ArrowUp, ChevronDown, Maximize2, RotateCcw, Settings2, Sparkles, Square, SquarePen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppContext } from "@/context/app/Index";
import { useEditorContext } from "@/context/editor/Index";
import { getTabSql, useTabSql } from "@/context/editor/store";
import { cn, errorMessage } from "@/lib/utils";
import { OpenSettingsWindow } from "@/services/bindings";
import { useAIProviders, useDefaultModel, type ChatContext, type ModelRef, type ProviderStatus, type Usage } from "@/services/ai";
import { chats, messageText, useActiveChat, type ChatMessage, type Conversation } from "@/services/chats";
import { ChatHistory } from "./ChatHistory";
import { ChatTabs } from "./ChatTabs";
import { MarkdownMessage } from "./MarkdownMessage";
import { ModelPicker } from "./ModelPicker";
import { ToolStep } from "./ToolStep";
import { UsageMeter } from "./UsageMeter";

/** The latest reply's tokens, kept on show while the next one streams. */
function lastUsage(messages: ChatMessage[]) {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].usage) return messages[i].usage;
  }
}

/** Reads the SQL when called, so typing doesn't re-render the chat. */
function useChatContext(): () => ChatContext {
  const { engine } = useAppContext();
  const { activeTab } = useEditorContext();
  const queryTabId = activeTab?.type === "query" ? activeTab.id : undefined;
  const error = activeTab?.error ?? "";
  return useCallback(
    () => ({ engine, sql: queryTabId ? getTabSql(queryTabId) : "", error }),
    [engine, queryTabId, error],
  );
}

/**
 * The active chat: `wide` fills the editor in AI mode with a tab per open
 * chat, otherwise it fits the side panel.
 */
export function AIChat({ wide = false }: { wide?: boolean }) {
  const providers = useAIProviders();
  const defaultModel = useDefaultModel();
  const chat = useActiveChat();
  const getContext = useChatContext();
  const usable = useMemo(() => (providers.data ?? []).filter((p) => p.ready), [providers.data]);

  const saved = defaultModel.data;
  const model = saved?.model && usable.some((p) => p.provider.id === saved.provider) ? saved : undefined;

  if (providers.isLoading || defaultModel.isLoading) return null;
  if (providers.error) {
    return <Intro title="AI isn't available" text={errorMessage(providers.error)} wide={wide} className="px-6" />;
  }
  if (usable.length === 0) {
    return (
      <Intro title="Set up AI" text="Add a provider in Settings." wide={wide} className="px-6">
        <Button size="xs" variant="outline" onClick={() => OpenSettingsWindow("ai")} className="cursor-pointer">
          <Settings2 />
          Open Settings
        </Button>
      </Intro>
    );
  }

  const streaming = chat.messages.some((m) => m.streaming);
  return (
    <div className={cn("flex flex-col h-full min-h-0", wide && "bg-background")}>
      {wide ? <ChatTabs /> : <PanelHeader title={chat.title} />}
      {chat.loaded ? (
        // Keyed per chat so its scroll position and draft don't carry over.
        <Fragment key={chat.id}>
          <MessageList chat={chat} getContext={getContext} streaming={streaming} hasModel={model !== undefined} wide={wide} />
          <Composer
            chatId={chat.id}
            wide={wide}
            getContext={getContext}
            streaming={streaming}
            providers={usable}
            model={model}
            usage={lastUsage(chat.messages)}
          />
        </Fragment>
      ) : (
        <div className="flex-1" />
      )}
    </div>
  );
}

/** The side panel's chat controls; AI mode has the tab bar instead. */
function PanelHeader({ title }: { title: string }) {
  const { setEditorMode } = useEditorContext();
  return (
    <div className="flex h-8 shrink-0 items-center gap-0.5 border-b border-border/50 px-1">
      <ChatHistory align="start">
        <button
          type="button"
          title="Chat history"
          className="inline-flex h-6 min-w-0 items-center gap-1 rounded-md px-1.5 text-[11px] text-muted-foreground hover:text-foreground cursor-pointer"
        >
          <span className="truncate">{title || "New chat"}</span>
          <ChevronDown className="size-3 shrink-0" />
        </button>
      </ChatHistory>
      <span className="flex-1" />
      <Button
        size="icon-xs"
        variant="ghost"
        onClick={() => chats.create()}
        title="New chat"
        aria-label="New chat"
        className="text-muted-foreground hover:text-foreground cursor-pointer"
      >
        <SquarePen />
      </Button>
      <Button
        size="icon-xs"
        variant="ghost"
        onClick={() => setEditorMode("ai")}
        title="Open in AI mode"
        aria-label="Open in AI mode"
        className="text-muted-foreground hover:text-foreground cursor-pointer"
      >
        <Maximize2 />
      </Button>
    </div>
  );
}

function Intro({
  title,
  text,
  wide,
  className,
  children,
}: {
  title: string;
  text: string;
  wide: boolean;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div className={cn("h-full flex flex-col items-center justify-center text-center", wide ? "gap-4" : "gap-3", className)}>
      <div className={cn("rounded-full bg-primary/10 flex items-center justify-center", wide ? "size-12" : "size-8")}>
        <Sparkles className={cn("text-primary/70", wide ? "size-6" : "size-4")} />
      </div>
      <div className="space-y-1">
        <p className={cn("font-medium", wide ? "text-base" : "text-xs")}>{title}</p>
        <p className={cn("text-muted-foreground", wide ? "text-sm" : "text-[11px]")}>{text}</p>
      </div>
      {children}
    </div>
  );
}

function MessageList({
  chat,
  getContext,
  streaming,
  hasModel,
  wide,
}: {
  chat: Conversation;
  getContext: () => ChatContext;
  streaming: boolean;
  hasModel: boolean;
  wide: boolean;
}) {
  const { messages } = chat;
  const ref = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const prevId = useRef<string | undefined>(undefined);
  const lastId = messages.at(-1)?.id;
  const lastParts = messages.at(-1)?.parts;

  // Jump to new messages; follow streamed output only while the user is at the bottom.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (prevId.current !== lastId) {
      prevId.current = lastId;
      stick.current = true;
    }
    if (stick.current) el.scrollTop = el.scrollHeight;
  }, [lastId, lastParts]);

  const onScroll = () => {
    const el = ref.current;
    if (el) stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
  };

  return (
    <div
      ref={ref}
      onScroll={onScroll}
      role="log"
      aria-live="polite"
      aria-busy={streaming}
      className={cn(
        "flex-1 min-h-0 overflow-y-scroll overflow-x-hidden leading-relaxed select-text",
        wide ? "px-6 py-6 text-[13px]" : "px-3 py-3 text-xs",
      )}
    >
      <div className={cn("min-h-full", wide ? "mx-auto max-w-3xl space-y-6" : "space-y-4")}>
        {messages.length === 0 ? (
          <EmptyState chatId={chat.id} getContext={getContext} hasModel={hasModel} wide={wide} />
        ) : (
          messages.map((m, i) => (
            <Message
              key={m.id}
              chatId={chat.id}
              message={m}
              last={i === messages.length - 1}
              getContext={getContext}
              wide={wide}
            />
          ))
        )}
      </div>
    </div>
  );
}

function EmptyState({
  chatId,
  getContext,
  hasModel,
  wide,
}: {
  chatId: string;
  getContext: () => ChatContext;
  hasModel: boolean;
  wide: boolean;
}) {
  const { activeTab } = useEditorContext();
  const sql = useTabSql(activeTab?.type === "query" ? activeTab.id : undefined);
  const error = activeTab?.error;
  if (!hasModel) return <Intro title="Choose a model" text="Pick one below to start." wide={wide} className="py-8" />;
  const suggestions = [
    error && "Fix my query error",
    sql.trim() && "Explain my query",
    sql.trim() && "Make my query faster",
    "What's in this database?",
  ].filter((s): s is string => Boolean(s));

  return (
    <Intro title="Ask about your data" text="Explore your data, or write and fix queries." wide={wide} className="py-8">
      <div className={cn("w-full flex", wide ? "flex-wrap justify-center gap-2 max-w-lg" : "flex-col items-stretch gap-1.5 max-w-64")}>
        {suggestions.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => chats.send(chatId, s, getContext())}
            className={cn(
              "border border-border/60 text-left text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer",
              wide ? "w-60 rounded-lg px-3 py-2.5 text-xs" : "rounded-md px-2.5 py-1.5 text-[11px]",
            )}
          >
            {s}
          </button>
        ))}
      </div>
    </Intro>
  );
}

function Message({
  chatId,
  message,
  last,
  getContext,
  wide,
}: {
  chatId: string;
  message: ChatMessage;
  last: boolean;
  getContext: () => ChatContext;
  wide: boolean;
}) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div
          className={cn(
            "bg-muted whitespace-pre-wrap break-words",
            wide ? "max-w-[75%] rounded-2xl px-4 py-2.5" : "max-w-[85%] rounded-lg px-3 py-2",
          )}
        >
          {messageText(message)}
        </div>
      </div>
    );
  }
  return (
    <div className={cn("min-w-0", wide ? "space-y-3" : "space-y-2")}>
      {message.parts.map((p, i) =>
        p.tool ? (
          <ToolStep key={p.tool.id || i} tool={p.tool} running={Boolean(message.streaming) && !p.tool.done} wide={wide} />
        ) : p.text ? (
          <MarkdownMessage key={i} content={p.text} />
        ) : null,
      )}
      {message.streaming && message.parts.length === 0 && (
        <p className="text-[11px] text-muted-foreground animate-pulse">Thinking…</p>
      )}
      {message.error && (
        <div className="mt-1 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-2.5 py-2 text-destructive">
          <AlertTriangle className="size-3.5 shrink-0 mt-0.5" />
          <p className="flex-1 min-w-0 break-words">{message.error}</p>
          {last && (
            <button
              type="button"
              onClick={() => chats.retry(chatId, getContext())}
              className="shrink-0 inline-flex items-center gap-1 text-[11px] font-medium hover:underline cursor-pointer"
            >
              <RotateCcw className="size-3" />
              Retry
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Composer({
  chatId,
  wide,
  getContext,
  streaming,
  providers,
  model,
  usage,
}: {
  chatId: string;
  wide: boolean;
  getContext: () => ChatContext;
  streaming: boolean;
  providers: ProviderStatus[];
  model?: ModelRef;
  usage?: Usage;
}) {
  const [input, setInput] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);
  const canSend = input.trim() !== "" && !streaming && model !== undefined;

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input]);

  const send = () => {
    if (!canSend) return;
    chats.send(chatId, input, getContext());
    setInput("");
  };

  return (
    <div className={cn("shrink-0", wide ? "px-6 pb-5 pt-2" : "border-t border-border/50 p-2")}>
      <div
        className={cn(
          "border border-input bg-background focus-within:ring-1 focus-within:ring-ring transition-shadow",
          wide ? "mx-auto max-w-3xl rounded-xl shadow-sm" : "rounded-md",
        )}
      >
        <textarea
          ref={ref}
          rows={1}
          autoFocus={wide}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Ask about your data…"
          title="Enter to send, Shift+Enter for a new line"
          aria-label="Message"
          className={cn(
            "block w-full resize-none bg-transparent leading-relaxed outline-none placeholder:text-muted-foreground",
            wide ? "px-3.5 pt-3 pb-1.5 text-sm" : "px-2.5 pt-2 pb-1 text-xs",
          )}
        />
        <div className={cn("flex items-center gap-1", wide ? "px-2 pb-2" : "px-1 pb-1")}>
          <ModelPicker value={model} providers={providers} disabled={streaming} />
          <span className="flex-1" />
          {usage && <UsageMeter usage={usage} />}
          {streaming ? (
            <Button
              size="icon-xs"
              variant="secondary"
              onClick={() => chats.stop(chatId)}
              title="Stop"
              aria-label="Stop generating"
              className="cursor-pointer"
            >
              <Square className="fill-current" />
            </Button>
          ) : (
            <Button
              size="icon-xs"
              onClick={send}
              disabled={!canSend}
              title="Send"
              aria-label="Send message"
              className="cursor-pointer disabled:opacity-40"
            >
              <ArrowUp />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
