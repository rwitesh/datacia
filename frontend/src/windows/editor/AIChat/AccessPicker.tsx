import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { Access } from "@/services/ai";
import { chats } from "@/services/chats";
import { accessLevel, accessLevels } from "./accessLevels";

const triggerClass = "inline-flex h-6 shrink-0 items-center gap-1 rounded-md px-1.5 text-[11px] text-muted-foreground";

type Props = {
  chatId: string;
  value: Access;
  /** A chat keeps the access it started with. */
  locked: boolean;
};

/** What the chat's AI may read from the database, chosen before the first message. */
export function AccessPicker({ chatId, value, locked }: Props) {
  const [open, setOpen] = useState(false);
  const { label, icon: Icon } = accessLevel(value);

  if (locked) {
    return (
      <span title="Start a new chat to change what the AI can see" className={triggerClass}>
        <Icon className="size-3 shrink-0" />
        {label}
      </span>
    );
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label="Database access"
        title="What the AI can see"
        className={cn(triggerClass, "hover:text-foreground cursor-pointer")}
      >
        <Icon className="size-3 shrink-0" />
        {label}
        <ChevronDown className="size-3 shrink-0" />
      </PopoverTrigger>
      <PopoverContent align="start" side="top" className="w-72 max-w-[calc(100vw-2rem)] p-1 text-xs">
        <p className="px-2 pt-1 pb-1.5 text-[10px] text-muted-foreground">What the AI can see in this chat</p>
        {accessLevels.map((level) => (
          <button
            key={level.access}
            type="button"
            onClick={() => {
              chats.setAccess(chatId, level.access);
              setOpen(false);
            }}
            className="flex w-full items-start gap-2 rounded px-2 py-1.5 text-left hover:bg-accent hover:text-accent-foreground cursor-pointer"
          >
            <level.icon className="size-3.5 shrink-0 mt-0.5 text-muted-foreground" />
            <span className="flex-1 min-w-0">
              <span className="block font-medium">{level.label}</span>
              <span className="block text-[11px] text-muted-foreground">{level.description}</span>
            </span>
            {level.access === value && <Check className="size-3 shrink-0 mt-0.5" />}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
