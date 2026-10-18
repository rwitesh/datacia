import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, ArrowUp, Database, Loader2, RotateCcw, Settings2, Sparkles, Square, SquarePen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppContext } from "@/context/app/Index";
import { useEditorContext } from "@/context/editor/Index";
import { useTabSql } from "@/context/editor/store";
import { cn } from "@/lib/utils";
import { OpenSettingsWindow } from "@/services/bindings";
import {
  chat,
  useAIProviders,
  useChat,
  useDefaultModel,
  type ChatContext,
  type ChatMessage,
  type ModelRef,
  type ProviderStatus,
  type ToolUse,
} from "@/services/ai";
import { MarkdownMessage } from "./MarkdownMessage";
import { ModelPicker } from "./ModelPicker";

function useChatContext(): ChatContext {
  const { engine } = useAppContext();
  const { activeTab } = useEditorContext();
  const sql = useTabSql(activeTab?.id);
  return {
    engine,
    sql: activeTab?.type === "query" ? sql : "",
    error: activeTab?.error ?? "",
  };
}

export function AIChat() {
  const providers = useAIProviders();
  const defaultModel = useDefaultModel();
  const state = useChat();
  const context = useChatContext();
  const usable = useMemo(() => (providers.data ?? []).filter((p) => p.ready), [providers.data]);

  const saved = defaultModel.data;
  const model = saved?.model && usable.some((p) => p.provider.id === saved.provider) ? saved : undefined;

  if (providers.isLoading || defaultModel.isLoading || !state.loaded) return null;
  if (usable.length === 0) {
    return (
      <Intro
        title="Set up AI"
        text="Add a provider in Settings."
        className="px-6"
      >
        <Button size="xs" variant="outline" onClick={() => OpenSettingsWindow("ai")} className="cursor-pointer">
          <Settings2 />
          Open Settings
        </Button>
      </Intro>
    );
  }

  const streaming = state.messages.some((m) => m.streaming);
  return (
    <div className="flex flex-col h-full min-h-0">
      <MessageList messages={state.messages} context={context} streaming={streaming} hasModel={model !== undefined} />
      <Composer
        context={context}
        streaming={streaming}
        providers={usable}
        model={model}
        canClear={state.messages.length > 0}
      />
    </div>
  );
}

function Intro({
  title,
  text,
  className,
  children,
}: {
  title: string;
  text: string;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div className={cn("h-full flex flex-col items-center justify-center gap-3 text-center", className)}>
      <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center">
        <Sparkles className="size-4 text-primary/70" />
      </div>
      <div className="space-y-1">
        <p className="text-xs font-medium">{title}</p>
        <p className="text-[11px] text-muted-foreground">{text}</p>
      </div>
      {children}
    </div>
  );
}

function MessageList({
  messages,
  context,
  streaming,
  hasModel,
}: {
  messages: ChatMessage[];
  context: ChatContext;
  streaming: boolean;
  hasModel: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const prevId = useRef<string | undefined>(undefined);
  const lastId = messages.at(-1)?.id;
  const lastContent = messages.at(-1)?.content;

  // Jump to new messages; follow streamed output only while the user is at the bottom.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (prevId.current !== lastId) {
      prevId.current = lastId;
      stick.current = true;
    }
    if (stick.current) el.scrollTop = el.scrollHeight;
  }, [lastId, lastContent]);

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
      className="flex-1 min-h-0 overflow-y-scroll overflow-x-hidden px-3 py-3 space-y-4 text-xs leading-relaxed select-text"
    >
      {messages.length === 0 ? (
        <EmptyState context={context} hasModel={hasModel} />
      ) : (
        messages.map((m, i) => (
          <Message key={m.id} message={m} last={i === messages.length - 1} context={context} />
        ))
      )}
    </div>
  );
}

function EmptyState({ context, hasModel }: { context: ChatContext; hasModel: boolean }) {
  if (!hasModel) return <Intro title="Choose a model" text="Pick one below to start." className="py-8" />;
  const suggestions = [
    context.error && "Fix my query error",
    context.sql.trim() && "Explain my query",
    context.sql.trim() && "Make my query faster",
    "What's in this database?",
  ].filter((s): s is string => Boolean(s));

  return (
    <Intro title="Ask about your data" text="Explore your data, or write and fix queries." className="py-8">
      <div className="flex flex-col items-stretch gap-1.5 w-full max-w-64">
        {suggestions.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => chat.send(s, context)}
            className="rounded-md border border-border/60 px-2.5 py-1.5 text-[11px] text-left text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer"
          >
            {s}
          </button>
        ))}
      </div>
    </Intro>
  );
}

function Message({ message, last, context }: { message: ChatMessage; last: boolean; context: ChatContext }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-lg bg-muted px-3 py-2 whitespace-pre-wrap break-words">
          {message.content}
        </div>
      </div>
    );
  }
  return (
    <div className="min-w-0">
      {message.tools && message.tools.length > 0 && <ToolCalls tools={message.tools} />}
      {message.content && <MarkdownMessage content={message.content} />}
      {message.streaming && (
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-1">
          <Loader2 className="size-3 animate-spin" />
          {!message.content && "Thinking…"}
        </div>
      )}
      {message.error && (
        <div className="mt-1 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-2.5 py-2 text-destructive">
          <AlertTriangle className="size-3.5 shrink-0 mt-0.5" />
          <p className="flex-1 min-w-0 break-words">{message.error}</p>
          {last && (
            <button
              type="button"
              onClick={() => chat.retry(context)}
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

/** What the model read to answer; queries expand to show their SQL. */
function ToolCalls({ tools }: { tools: ToolUse[] }) {
  const row = "flex items-center gap-1.5";
  return (
    <ul className="mb-1.5 space-y-0.5 text-[11px] text-muted-foreground">
      {tools.map((t, i) => {
        const label = (
          <>
            <Database className="size-3 shrink-0" />
            {t.label}
          </>
        );
        return (
          <li key={i}>
            {t.sql ? (
              <details>
                <summary className={cn(row, "list-none cursor-pointer hover:text-foreground")}>{label}</summary>
                <pre className="mt-1 rounded bg-muted/60 px-2 py-1 font-mono text-[10px] whitespace-pre-wrap break-words select-text">
                  {t.sql}
                </pre>
              </details>
            ) : (
              <div className={row}>{label}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function Composer({
  context,
  streaming,
  providers,
  model,
  canClear,
}: {
  context: ChatContext;
  streaming: boolean;
  providers: ProviderStatus[];
  model?: ModelRef;
  canClear: boolean;
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
    chat.send(input, context);
    setInput("");
  };

  return (
    <div className="shrink-0 border-t border-border/50 p-2">
      <div className="rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring transition-shadow">
        <textarea
          ref={ref}
          rows={1}
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
          className="block w-full resize-none bg-transparent px-2.5 pt-2 pb-1 text-xs leading-relaxed outline-none placeholder:text-muted-foreground"
        />
        <div className="flex items-center gap-1 px-1 pb-1">
          <ModelPicker value={model} providers={providers} disabled={streaming} />
          <span className="flex-1" />
          {canClear && (
            <Button
              size="icon-xs"
              variant="ghost"
              onClick={() => chat.clear()}
              title="New chat"
              aria-label="New chat"
              className="text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <SquarePen />
            </Button>
          )}
          {streaming ? (
            <Button
              size="icon-xs"
              variant="secondary"
              onClick={() => chat.stop()}
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
