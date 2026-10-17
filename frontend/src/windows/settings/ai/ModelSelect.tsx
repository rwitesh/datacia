import { useId, useState } from "react";
import { ChevronDown, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn, errorMessage } from "@/lib/utils";
import { useProviderModels } from "@/services/ai";

type Props = {
  provider: string;
  url: string;
  apiKey: string;
  enabled: boolean;
  models: string[];
  onChange: (models: string[]) => void;
};

export function ModelSelect({ provider, url, apiKey, enabled, models, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const { data: available, error, isFetching, refetch } = useProviderModels(provider, url, apiKey, enabled && open);
  const [search, setSearch] = useState("");
  const [active, setActive] = useState(0);
  const listId = useId();

  const term = search.trim();
  const lower = term.toLowerCase();
  const options = (available ?? [])
    .filter((m) => !models.includes(m.id))
    .filter((m) => m.id.toLowerCase().includes(lower) || m.name.toLowerCase().includes(lower))
    .map((m) => ({ ...m, custom: false }));
  const custom = term !== "" && !models.includes(term) && !available?.some((m) => m.id === term);
  if (custom) options.push({ id: term, name: term, custom: true });
  const optionId = (i: number) => `${listId}-${i}`;

  const add = (id: string) => {
    onChange([...models, id]);
    setSearch("");
    setActive(0);
  };

  const status = error ? (
    <p className="px-3 py-2 text-xs text-destructive">
      {errorMessage(error)}{" "}
      <button type="button" onClick={() => void refetch()} className="underline cursor-pointer">
        Retry
      </button>
    </p>
  ) : !available ? (
    <p className="flex items-center gap-1.5 px-3 py-2 text-xs text-muted-foreground">
      <Loader2 className="size-3 animate-spin" />
      Loading models…
    </p>
  ) : (
    options.length === 0 && <p className="px-3 py-2 text-xs text-muted-foreground">No more models</p>
  );

  return (
    <div className="space-y-1.5">
      <p className="text-xs text-muted-foreground">Models in the chat</p>
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
            {enabled ? "Add a model…" : "Add an API key to choose models"}
            {isFetching ? <Loader2 className="size-3 animate-spin" /> : <ChevronDown className="size-3" />}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-(--radix-popover-trigger-width) p-0">
          <Input
            autoFocus
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-activedescendant={options[active] ? optionId(active) : undefined}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                e.preventDefault();
                const step = e.key === "ArrowDown" ? 1 : -1;
                setActive((i) => Math.min(Math.max(i + step, 0), Math.max(options.length - 1, 0)));
              } else if (e.key === "Enter" && options[active]) {
                e.preventDefault();
                add(options[active].id);
              }
            }}
            placeholder="Search models"
            spellCheck={false}
            className="h-8 rounded-b-none border-0 border-b text-xs shadow-none focus-visible:ring-0"
          />
          {status}
          <ul id={listId} role="listbox" className="max-h-64 overflow-y-auto p-1 text-xs empty:hidden">
            {options.map((m, i) => (
              <li
                key={m.id}
                id={optionId(i)}
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onClick={() => add(m.id)}
                className={cn("flex flex-col rounded px-2 py-1 cursor-pointer", i === active && "bg-accent text-accent-foreground")}
              >
                {m.custom ? (
                  <span>
                    Use custom ID <span className="font-mono">{m.id}</span>
                  </span>
                ) : (
                  <>
                    <span>{m.name}</span>
                    {m.name !== m.id && <span className="font-mono text-[10px] text-muted-foreground">{m.id}</span>}
                  </>
                )}
              </li>
            ))}
          </ul>
        </PopoverContent>
      </Popover>
      {enabled && models.length === 0 && (
        <p className="text-[11px] text-muted-foreground">Choose at least one model to use this provider.</p>
      )}
    </div>
  );
}
