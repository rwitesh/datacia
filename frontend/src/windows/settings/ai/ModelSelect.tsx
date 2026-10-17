import { useState } from "react";
import { Command } from "cmdk";
import { ChevronDown, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { errorMessage } from "@/lib/utils";
import { useProviderModels } from "@/services/ai";

type Props = {
  provider: string;
  url: string;
  apiKey: string;
  enabled: boolean;
  models: string[];
  onChange: (models: string[]) => void;
};

const itemClass =
  "flex flex-col rounded px-2 py-1 cursor-pointer data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground";

export function ModelSelect({ provider, url, apiKey, enabled, models, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { data: available, error, isFetching, refetch } = useProviderModels(provider, url, apiKey, enabled && open);

  const options = (available ?? []).filter((m) => !models.includes(m.id));
  const term = search.trim();
  const custom = term !== "" && !models.includes(term) && !available?.some((m) => m.id === term);

  const add = (id: string) => {
    onChange([...models, id]);
    setSearch("");
  };

  return (
    <div className="space-y-1.5">
      <p className="text-xs text-muted-foreground">Models</p>
      {models.length > 0 && (
        <ul className="flex flex-wrap gap-1">
          {models.map((m) => (
            <li key={m} className="inline-flex items-center gap-1 rounded border bg-muted/40 pl-2 pr-0.5 py-0.5 text-xs font-mono">
              {m}
              <button
                type="button"
                onClick={() => onChange(models.filter((x) => x !== m))}
                aria-label={`Remove ${m}`}
                className="rounded p-0.5 text-muted-foreground hover:text-destructive cursor-pointer"
              >
                <X className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!enabled}
            className="h-7 w-full justify-between text-xs font-normal text-muted-foreground cursor-pointer"
          >
            {enabled ? "Add a model…" : "Add an API key first"}
            {isFetching ? <Loader2 className="size-3 animate-spin" /> : <ChevronDown className="size-3" />}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-(--radix-popover-trigger-width) p-0">
          <Command className="text-xs">
            <Command.Input
              autoFocus
              value={search}
              onValueChange={setSearch}
              placeholder="Search models"
              spellCheck={false}
              className="h-8 w-full border-b bg-transparent px-3 outline-none placeholder:text-muted-foreground"
            />
            {error ? (
              <p className="px-3 py-2 text-destructive">
                {errorMessage(error)}{" "}
                <button type="button" onClick={() => void refetch()} className="underline cursor-pointer">
                  Retry
                </button>
              </p>
            ) : (
              !available && (
                <p className="flex items-center gap-1.5 px-3 py-2 text-muted-foreground">
                  <Loader2 className="size-3 animate-spin" />
                  Loading models…
                </p>
              )
            )}
            <Command.List className="max-h-64 overflow-y-auto p-1 empty:hidden">
              {available && <Command.Empty className="px-2 py-1 text-muted-foreground">No more models</Command.Empty>}
              {options.map((m) => (
                <Command.Item key={m.id} value={m.id} keywords={[m.name]} onSelect={() => add(m.id)} className={itemClass}>
                  <span>{m.name}</span>
                  {m.name !== m.id && <span className="font-mono text-[10px] text-muted-foreground">{m.id}</span>}
                </Command.Item>
              ))}
              {custom && (
                <Command.Item value={term} forceMount onSelect={() => add(term)} className={itemClass}>
                  <span>
                    Use custom ID <span className="font-mono">{term}</span>
                  </span>
                </Command.Item>
              )}
            </Command.List>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
