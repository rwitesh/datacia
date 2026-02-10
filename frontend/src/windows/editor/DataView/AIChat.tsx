import { useRef, useState, useEffect } from "react";
import { SendHorizontal, Bot, Loader2, Sparkles, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSendAIMessage } from "@/services/ai";
import { useAppContext } from "@/context/app/Index";
import { useEditorContext } from "@/context/editor/Index";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";

interface Message {
  role: "user" | "assistant";
  content?: string;
  error?: string;
}

function AssistantMessage({ content, error }: { content?: string; error?: string }) {
  const hasContent = content?.trim();
  const hasError = error?.trim();

  if (hasError) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2">
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium text-destructive">Something went wrong</p>
            <p className="text-[11px] text-destructive/90 mt-0.5 break-words">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!hasContent) return null;

  return (
    <Markdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeRaw]}
      components={{
        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
        strong: ({ children }) => (
          <strong className="font-semibold text-foreground">{children}</strong>
        ),
        em: ({ children }) => <em className="italic">{children}</em>,
        h1: ({ children }) => (
          <h1 className="text-sm font-semibold mb-2 mt-3 first:mt-0">
            {children}
          </h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-[13px] font-semibold mb-1.5 mt-2.5 first:mt-0">
            {children}
          </h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-xs font-semibold mb-1 mt-2 first:mt-0">
            {children}
          </h3>
        ),
        ul: ({ children }) => (
          <ul className="list-disc pl-4 mb-2 last:mb-0 space-y-0.5">
            {children}
          </ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal pl-4 mb-2 last:mb-0 space-y-0.5">
            {children}
          </ol>
        ),
        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
        code: ({ children, className }) => {
          const isBlock = className?.includes("language-");
          if (isBlock) {
            return (
              <code className="block bg-black/5 dark:bg-white/5 rounded px-2.5 py-2 text-[11px] leading-relaxed font-mono overflow-auto max-h-60 whitespace-pre">
                {children}
              </code>
            );
          }
          return (
            <code className="bg-black/5 dark:bg-white/8 rounded px-1 py-0.5 text-[11px] font-mono">
              {children}
            </code>
          );
        },
        pre: ({ children }) => (
          <pre className="mb-2 last:mb-0 overflow-auto rounded-md">
            {children}
          </pre>
        ),
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-2 hover:opacity-80"
          >
            {children}
          </a>
        ),
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-border pl-3 my-2 text-muted-foreground italic">
            {children}
          </blockquote>
        ),
        hr: () => <hr className="my-3 border-border/50" />,
        table: ({ children }) => (
          <div className="overflow-x-auto mb-2 last:mb-0">
            <table className="w-full text-[11px] border-collapse">
              {children}
            </table>
          </div>
        ),
        th: ({ children }) => (
          <th className="border border-border/50 px-2 py-1 text-left font-semibold bg-muted/50">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="border border-border/50 px-2 py-1.5 align-top">
            {children}
          </td>
        ),
        thead: ({ children }) => <thead>{children}</thead>,
        tbody: ({ children }) => <tbody>{children}</tbody>,
        tr: ({ children }) => <tr>{children}</tr>,
      }}
    >
      {content}
    </Markdown>
  );
}

export function AIChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { engine } = useAppContext();
  const { activeTab } = useEditorContext();
  const sendMessage = useSendAIMessage();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sendMessage.isPending]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || sendMessage.isPending) return;

    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    setInput("");

    const sql = activeTab?.sql || "";
    const error = activeTab?.error;
    const context =
      error != null && error.trim() !== ""
        ? JSON.stringify({ sql, error })
        : sql;
        
    sendMessage.mutate(
      { engine, context, message: trimmed },
      {
        onSuccess: (response) => {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: response },
          ]);
        },
        onError: (err) => {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", error: err.message },
          ]);
        },
      },
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="px-4 py-3 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/8 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-primary/60" />
              </div>
              <div className="text-center space-y-1">
                <p className="text-xs font-medium text-foreground/70">
                  Ask anything about your data
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Ask questions, write queries, and get insights
                </p>
              </div>
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} className="flex flex-col gap-1">
              {msg.role === "user" ? (
                <div className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary text-primary-foreground px-3 py-2 text-xs leading-relaxed break-words whitespace-pre-wrap">
                    {msg.content}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <div className="w-5 h-5 rounded-full bg-primary/8 flex items-center justify-center">
                    <Bot className="w-3 h-3 text-primary/70" />
                  </div>
                  <div className="min-w-0 w-full text-xs leading-relaxed text-foreground">
                    <AssistantMessage content={msg.content} error={msg.error} />
                  </div>
                </div>
              )}
            </div>
          ))}
          {sendMessage.isPending && (
            <div className="flex flex-col gap-1.5">
              <div className="w-5 h-5 rounded-full bg-primary/8 flex items-center justify-center">
                <Bot className="w-3 h-3 text-primary/70" />
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground px-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span className="text-[11px]">Thinking...</span>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>
      <div className="flex-shrink-0 border-t border-border/40 px-4 py-2">
        <div className="flex items-center gap-1.5 rounded-lg border border-input bg-background px-2 focus-within:ring-1 focus-within:ring-ring transition-shadow">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question..."
            disabled={sendMessage.isPending}
            className="flex-1 min-w-0 h-8 bg-transparent text-xs placeholder:text-muted-foreground focus-visible:outline-none disabled:opacity-50"
          />
          <Button
            size="icon-xs"
            variant="ghost"
            onClick={handleSend}
            disabled={!input.trim() || sendMessage.isPending}
            className="flex-shrink-0 text-muted-foreground hover:text-foreground disabled:opacity-30"
          >
            <SendHorizontal className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
