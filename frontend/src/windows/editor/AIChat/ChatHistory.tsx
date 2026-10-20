import { useState, type ReactNode } from "react";
import { Command } from "cmdk";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn, errorMessage } from "@/lib/utils";
import { useChatHistory } from "@/services/ai";
import { chats } from "@/services/chats";
import { queryKeys } from "@/services/queryKeys";
import { timeAgo } from "../EditorSidebar/utils";

const rowClass = "flex items-center gap-2 rounded px-2 py-1.5";

/** Saved chats to reopen or delete. `children` is the trigger. */
export function ChatHistory({ children, align = "end" }: { children: ReactNode; align?: "start" | "end" }) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align={align} className="w-80 p-0">
        {open && <HistoryList onOpen={() => setOpen(false)} />}
      </PopoverContent>
    </Popover>
  );
}

function HistoryList({ onOpen }: { onOpen: () => void }) {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useChatHistory();
  // Deleting can't be undone, so it takes a second click.
  const [confirmId, setConfirmId] = useState<string>();

  const remove = async (id: string) => {
    try {
      await chats.remove(id);
    } catch (err) {
      toast.error("Couldn't delete the chat", { description: errorMessage(err) });
    }
    setConfirmId(undefined);
    queryClient.invalidateQueries({ queryKey: queryKeys.aiChats });
  };

  return (
    // Matches titles only; the default fuzzy match would also hit chat IDs.
    <Command
      className="text-xs"
      filter={(_, search, keywords) => (keywords?.[0]?.toLowerCase().includes(search.toLowerCase()) ? 1 : 0)}
    >
      <Command.Input
        autoFocus
        placeholder="Search chats"
        spellCheck={false}
        className="h-8 w-full border-b bg-transparent px-3 outline-none placeholder:text-muted-foreground"
      />
      <Command.List className="max-h-80 overflow-y-auto p-1">
        {isLoading ? (
          <div className={cn(rowClass, "text-muted-foreground")}>
            <Loader2 className="size-3 animate-spin" />
            Loading…
          </div>
        ) : error ? (
          <p className="px-2 py-1.5 text-destructive">{errorMessage(error)}</p>
        ) : (
          <Command.Empty className="px-2 py-1.5 text-muted-foreground">No chats yet</Command.Empty>
        )}
        {data?.map((c) => (
          <Command.Item
            key={c.id}
            value={c.id}
            keywords={[c.title]}
            onSelect={() => {
              void chats.open(c.id);
              onOpen();
            }}
            className={cn(rowClass, "group cursor-pointer data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground")}
          >
            <span className="flex-1 truncate">{c.title || "Untitled chat"}</span>
            <span className="shrink-0 text-[10px] text-muted-foreground group-hover:hidden">{timeAgo(c.updatedAt)}</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (confirmId === c.id) void remove(c.id);
                else setConfirmId(c.id);
              }}
              onPointerLeave={() => setConfirmId(undefined)}
              title={confirmId === c.id ? "Click again to delete" : "Delete chat"}
              aria-label="Delete chat"
              className={cn(
                "hidden shrink-0 items-center gap-1 rounded px-1 group-hover:inline-flex cursor-pointer",
                confirmId === c.id ? "text-destructive" : "text-muted-foreground hover:text-destructive",
              )}
            >
              <Trash2 className="size-3" />
              {confirmId === c.id && <span className="text-[10px]">Delete?</span>}
            </button>
          </Command.Item>
        ))}
      </Command.List>
    </Command>
  );
}
