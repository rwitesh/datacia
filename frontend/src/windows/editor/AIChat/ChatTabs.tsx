import type React from "react";
import { History, Loader2, MessageSquare, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { chats, useChats } from "@/services/chats";
import { ChatHistory } from "./ChatHistory";

/** The open chats in AI mode, like the SQL tabs in query mode. */
export function ChatTabs() {
  const { open, activeId } = useChats();

  const onMouseDown = (e: React.MouseEvent, id: string) => {
    if (e.button === 0) chats.activate(id);
    else if (e.button === 1) chats.close(id);
  };

  return (
    <div className="flex shrink-0 items-center border-b border-border">
      <div className="flex h-full flex-1 items-center gap-0.5 overflow-x-auto overflow-y-hidden px-1 py-1 scrollbar-thin">
        {open.map((c) => {
          const isActive = c.id === activeId;
          const streaming = c.messages.some((m) => m.streaming);
          return (
            <div
              key={c.id}
              className={cn(
                "group relative flex min-w-36 max-w-56 select-none items-center rounded-md transition-all duration-200",
                isActive ? "bg-background shadow-sm ring-1 ring-border/50" : "hover:bg-background/50",
              )}
            >
              {isActive && (
                <div className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-primary" />
              )}
              <div
                className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 px-3 py-1"
                onMouseDown={(e) => onMouseDown(e, c.id)}
              >
                {streaming || !c.loaded ? (
                  <Loader2 className="size-3.5 shrink-0 animate-spin text-primary" />
                ) : (
                  <MessageSquare className="size-3.5 shrink-0 text-primary" />
                )}
                <span className={cn("min-w-0 flex-1 truncate text-sm", isActive ? "font-medium" : "text-muted-foreground")}>
                  {c.title || "New chat"}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="mr-1.5 h-5 w-5 cursor-pointer rounded-full p-0 opacity-0 transition-opacity hover:bg-destructive/20 group-hover:opacity-100"
                onClick={() => chats.close(c.id)}
                aria-label="Close chat"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-0.5 px-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => chats.create()}
          title="New chat"
          className="h-7 cursor-pointer gap-1 rounded-md px-2.5 text-xs font-semibold text-primary select-none"
        >
          <Plus className="size-3.5" />
          Chat
        </Button>
        <ChatHistory>
          <Button
            variant="ghost"
            size="sm"
            title="Chat history"
            className="h-7 cursor-pointer gap-1 rounded-md px-2.5 text-xs text-muted-foreground hover:text-foreground select-none"
          >
            <History className="size-3.5" />
            History
          </Button>
        </ChatHistory>
      </div>
    </div>
  );
}
