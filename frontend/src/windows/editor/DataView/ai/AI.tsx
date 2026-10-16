import { useRef, useState, useEffect, useMemo } from "react";
import { SendHorizontal, Bot, Loader2, Sparkles, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSendAIMessage } from "@/services/ai";
import { useSettings } from "@/services/settings";
import { OpenSettingsWindow } from "@/services/bindings";
import { useAppContext } from "@/context/app/Index";
import { useEditorContext } from "@/context/editor/Index";
import { AssistantMessage } from "./Message";

interface Message {
  role: "user" | "assistant";
  content?: string;
  error?: string;
}

const KEY_MASK = "***";
const DEFAULT_GEMINI_MODEL = "gemini-3-flash-preview";

export function AIChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [chosenModel, setSelectedModel] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { engine } = useAppContext();
  const { activeTab } = useEditorContext();
  const { data: settings } = useSettings();
  const sendMessage = useSendAIMessage();

  const availableModels = useMemo(() => {
    const list: { value: string; label: string }[] = [];
    const g = settings?.settings?.ai?.gemini;
    const geminiKeyConfigured = g?.key === KEY_MASK || (g?.key && g.key !== "");
    if (g?.enabled && geminiKeyConfigured) {
      const models = g.models?.length ? g.models : [DEFAULT_GEMINI_MODEL];
      models.forEach((modelId) => list.push({ value: modelId, label: modelId }));
    }
    return list;
  }, [settings?.settings?.ai]);

  // Fall back to the first configured model when the chosen one is unavailable.
  const selectedModel = availableModels.some((m) => m.value === chosenModel)
    ? chosenModel
    : (availableModels[0]?.value ?? "");

  const isSelectedModelConfigured = useMemo(() => {
    const g = settings?.settings?.ai?.gemini;
    const keyOk = g?.key === KEY_MASK || (g?.key && g.key !== "");
    const effectiveModels = g?.models?.length ? g.models : [DEFAULT_GEMINI_MODEL];
    return !!(g?.enabled && keyOk && effectiveModels.includes(selectedModel));
  }, [selectedModel, settings?.settings?.ai]);


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
      { engine, context, message: trimmed, model: selectedModel },
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

  const noModels = availableModels.length === 0;

  if (noModels) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
          <button
            type="button"
            onClick={() => OpenSettingsWindow("ai")}
            className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border/60 bg-muted/30 hover:bg-muted/50 hover:border-primary/40 transition-colors p-8 cursor-pointer text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            aria-label="Add a model"
          >
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Plus className="w-6 h-6 text-primary/70" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-xs font-medium text-foreground/70">
                Add a model to get started
              </p>
              <p className="text-[11px] text-muted-foreground">
                Open Settings → AI to enable a provider and add models
              </p>
            </div>
          </button>
        </div>
      </div>
    );
  }

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
              <div className="rounded-full bg-primary/8 flex items-center gap-1.5 px-2.5 py-1.5 w-fit">
                <Bot className="w-3 h-3 text-primary/70 flex-shrink-0" />
                <Loader2 className="w-3 h-3 animate-spin text-muted-foreground flex-shrink-0" />
                <span className="text-[11px] text-muted-foreground">Thinking...</span>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>
      <div className="flex-shrink-0 border-t border-border/40 px-3 py-1.5">
        {!isSelectedModelConfigured && (
          <p className="text-[10px] text-amber-600 dark:text-amber-500 mb-1">
            Enable and set an API key in Settings → AI to use this model.
          </p>
        )}
        <div className="rounded-md border border-input bg-background px-1.5 py-1 focus-within:ring-1 focus-within:ring-ring transition-shadow">
          <Input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question..."
            disabled={sendMessage.isPending}
            className="h-6 min-h-0 w-full min-w-0 border-0 !bg-background px-1 py-0.5 text-xs shadow-none placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0 disabled:opacity-50"
          />
          <div className="flex items-center justify-between gap-1 pt-0.5 mt-0.5">
            <div className="flex items-center gap-1 min-w-0">
              <Select
                value={selectedModel}
                onValueChange={setSelectedModel}
                disabled={sendMessage.isPending}
              >
                <SelectTrigger size="sm" className="h-5 max-h-[1.5rem] text-xs font-normal border-0 bg-background shadow-none focus:ring-0 py-0 [&>svg]:w-2.5 [&>svg]:h-2.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableModels.map((m) => (
                    <SelectItem key={m.value} value={m.value} className="text-xs py-1">
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              size="icon"
              variant="ghost"
              onClick={handleSend}
              disabled={
                !input.trim() ||
                sendMessage.isPending ||
                !isSelectedModelConfigured
              }
              className="size-5 min-w-5 min-h-5 p-0 flex-shrink-0 text-muted-foreground hover:text-foreground disabled:opacity-30 [&_svg]:size-3"
            >
              <SendHorizontal className="w-3 h-3" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
