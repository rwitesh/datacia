import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, ArrowUp, Loader2, RotateCcw, Settings2, Sparkles, Square, SquarePen } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAppContext } from "@/context/app/Index";
import { useEditorContext } from "@/context/editor/Index";
import { cn } from "@/lib/utils";
import { OpenSettingsWindow } from "@/services/bindings";
import { chat, useAIProviders, useChat, type ChatContext, type ChatMessage, type ProviderStatus } from "@/services/ai";
import { MarkdownMessage } from "./MarkdownMessage";

const SEP = "::";
const MANAGE = "__manage__";

function useChatContext(): ChatContext {
  const { engine } = useAppContext();
  const { activeTab, tables } = useEditorContext();
  return {
    engine,
    sql: activeTab?.type === "query" ? activeTab.sql : "",
    error: activeTab?.error ?? "",
    tables: tables.data,
  };
}

export function AIChat() {
  const { data: providers, isLoading } = useAIProviders();
  const state = useChat();
  const context = useChatContext();
  const usable = useMemo(() => (providers ?? []).filter((p) => p.ready), [providers]);

  const selected = usable.some((p) => p.provider.id === state.provider && p.models.includes(state.model));
  useEffect(() => {
    if (!state.loaded || selected || usable.length === 0) return;
    chat.selectModel(usable[0].provider.id, usable[0].models[0]);
  }, [state.loaded, selected, usable]);

  if (isLoading || !state.loaded) return null;
  if (usable.length === 0) {
    return (
      <Intro
        title="Connect an AI provider"
        text="Add an API key for Anthropic, OpenAI, Gemini, OpenRouter, OpenCode, or point to a local model."
        className="px-6"
      >
        <Button size="xs" variant="outline" onClick={() => OpenSettingsWindow("ai")} className="cursor-pointer">
          <Settings2 />
          Open AI settings
        </Button>
      </Intro>
    );
  }

  const streaming = state.messages.some((m) => m.streaming);
  return (
    <div className="flex flex-col h-full min-h-0">
      <MessageList messages={state.messages} context={context} streaming={streaming} />
      <Composer
        context={context}
        streaming={streaming}
        providers={usable}
        model={selected ? `${state.provider}${SEP}${state.model}` : ""}
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
}: {
  messages: ChatMessage[];
  context: ChatContext;
  streaming: boolean;
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
      className="flex-1 min-h-0 scroll-stable overflow-x-hidden px-3 py-3 space-y-4 text-xs leading-relaxed select-text"
    >
      {messages.length === 0 ? (
        <EmptyState context={context} />
      ) : (
        messages.map((m, i) => (
          <Message key={m.id} message={m} last={i === messages.length - 1} context={context} />
        ))
      )}
    </div>
  );
}

function EmptyState({ context }: { context: ChatContext }) {
  const suggestions = [
    context.error && "Why did my query fail, and how do I fix it?",
    context.sql.trim() && "Explain the query in my editor",
    context.sql.trim() && "Can this query be made faster?",
    context.tables.length > 0 && "Which tables are in this database and how do they relate?",
  ].filter((s): s is string => Boolean(s));

  return (
    <Intro title="Ask about your data" text="Write queries, explain them, or fix errors." className="py-8">
      {suggestions.length > 0 && (
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
      )}
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

function ModelPicker({
  value,
  providers,
  disabled,
}: {
  value: string;
  providers: ProviderStatus[];
  disabled: boolean;
}) {
  const onChange = (v: string) => {
    if (v === MANAGE) {
      OpenSettingsWindow("ai");
      return;
    }
    const i = v.indexOf(SEP);
    chat.selectModel(v.slice(0, i), v.slice(i + SEP.length));
  };
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger
        size="sm"
        aria-label="Model"
        className="h-6 max-w-44 min-w-0 gap-1 border-0 bg-transparent dark:bg-transparent px-1.5 text-[11px] text-muted-foreground shadow-none hover:text-foreground focus-visible:ring-0 [&_svg]:size-3"
      >
        <SelectValue placeholder="Choose a model" />
      </SelectTrigger>
      <SelectContent>
        {providers.map((p) => (
          <SelectGroup key={p.provider.id}>
            <SelectLabel className="text-[10px]">{p.provider.name}</SelectLabel>
            {p.models.map((m) => (
              <SelectItem key={m} value={`${p.provider.id}${SEP}${m}`} className="text-xs py-1">
                {m}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
        <SelectSeparator />
        <SelectItem value={MANAGE} className="text-xs py-1">
          Manage models…
        </SelectItem>
      </SelectContent>
    </Select>
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
  model: string;
  canClear: boolean;
}) {
  const [input, setInput] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);
  const canSend = input.trim() !== "" && !streaming && model !== "";

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

  const contextSummary = [
    context.engine,
    context.sql.trim() && "editor SQL",
    context.error && "last error",
    context.tables.length > 0 && `${context.tables.length} table names`,
  ]
    .filter(Boolean)
    .join(", ");

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
          <span
            className="flex-1 min-w-0 truncate text-[10px] text-muted-foreground/80"
            title={`Sent with each message: ${contextSummary}`}
          >
            {contextSummary}
          </span>
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
