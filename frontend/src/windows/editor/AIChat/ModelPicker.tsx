import { useState } from "react";
import { Command } from "cmdk";
import { Check, ChevronDown, Loader2, Settings2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn, errorMessage } from "@/lib/utils";
import { OpenSettingsWindow } from "@/services/bindings";
import { useModelLists, useSetDefaultModel, type ModelRef, type ProviderStatus } from "@/services/ai";

type Props = {
  providers: ProviderStatus[];
  /** The default model, if its provider is set up. */
  value?: ModelRef;
  disabled: boolean;
};

const rowClass = "flex items-center gap-2 rounded px-2 py-1";

export function ModelPicker({ providers, value, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const select = useSetDefaultModel();
  // The chosen provider's list names the trigger; the others load on open.
  const lists = useModelLists(
    providers.map((p) => p.provider.id),
    (id) => open || id === value?.provider,
  );
  const chosen = value && lists[providers.findIndex((p) => p.provider.id === value.provider)]?.data?.find((m) => m.id === value.model);

  const choose = (model: ModelRef) => {
    select.mutate(model);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        disabled={disabled}
        aria-label="Model"
        className="inline-flex h-6 max-w-44 min-w-0 items-center gap-1 rounded-md px-1.5 text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-50 cursor-pointer"
      >
        <span className="truncate">{value ? (chosen?.name ?? value.model) : "Choose a model"}</span>
        <ChevronDown className="size-3 shrink-0" />
      </PopoverTrigger>
      <PopoverContent align="start" side="top" className="w-72 p-0">
        <Command className="text-xs">
          <Command.Input
            autoFocus
            placeholder="Search models"
            spellCheck={false}
            className="h-8 w-full border-b bg-transparent px-3 outline-none placeholder:text-muted-foreground"
          />
          <Command.List className="max-h-72 overflow-y-auto p-1">
            <Command.Empty className="px-2 py-1 text-muted-foreground">No models found</Command.Empty>
            {providers.map(({ provider }, i) => {
              const { data, error, refetch } = lists[i];
              return (
                <Command.Group
                  key={provider.id}
                  heading={provider.name}
                  className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:text-muted-foreground"
                >
                  {error ? (
                    <p className="px-2 py-1 text-destructive">
                      {errorMessage(error)}{" "}
                      <button type="button" onClick={() => void refetch()} className="underline cursor-pointer">
                        Retry
                      </button>
                    </p>
                  ) : !data ? (
                    <div className={cn(rowClass, "text-muted-foreground")}>
                      <Loader2 className="size-3 animate-spin" />
                      Loading…
                    </div>
                  ) : (
                    data.map((m) => (
                      <Command.Item
                        key={m.id}
                        value={`${provider.id}/${m.id}`}
                        keywords={[m.name]}
                        onSelect={() => choose({ provider: provider.id, model: m.id })}
                        className={cn(rowClass, "cursor-pointer data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground")}
                      >
                        <span className="flex-1 truncate">{m.name}</span>
                        {value?.provider === provider.id && value.model === m.id && <Check className="size-3 shrink-0" />}
                      </Command.Item>
                    ))
                  )}
                </Command.Group>
              );
            })}
          </Command.List>
          <button
            type="button"
            onClick={() => OpenSettingsWindow("ai")}
            className={cn(rowClass, "w-full border-t px-3 py-1.5 text-muted-foreground hover:text-foreground cursor-pointer")}
          >
            <Settings2 className="size-3" />
            Manage providers…
          </button>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
