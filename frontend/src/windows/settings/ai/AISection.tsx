import { useState } from "react";
import { Check, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn, errorMessage } from "@/lib/utils";
import { useAIProviders, type ProviderStatus } from "@/services/ai";
import type { AIProviderConfig, Settings as AppSettings } from "@/services/settings";
import { KeyField } from "./KeyField";
import { ModelSelect } from "./ModelSelect";

type Props = {
  settings: AppSettings;
  onChange: (settings: AppSettings) => void;
};

export function AISection({ settings, onChange }: Props) {
  const { data: providers, error } = useAIProviders();
  const configs = settings.ai?.providers ?? {};

  const update = (status: ProviderStatus, patch: Partial<AIProviderConfig>) => {
    const id = status.provider.id;
    const current = configs[id] ?? { models: [], baseUrl: "" };
    onChange({ ...settings, ai: { ...settings.ai, providers: { ...configs, [id]: { ...current, ...patch } } } });
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold">AI providers</h3>
        <p className="text-xs text-muted-foreground">
          Connect one or more providers to use the AI chat. Keys are encrypted and stored on this computer only.
        </p>
      </div>
      {error && <p className="text-xs text-destructive">{errorMessage(error)}</p>}
      <div className="space-y-2">
        {providers?.map((p) => {
          const config = configs[p.provider.id];
          return (
            <ProviderCard
              key={p.provider.id}
              status={p}
              models={config?.models ?? []}
              baseUrl={config?.baseUrl ?? ""}
              onChange={(patch) => update(p, patch)}
            />
          );
        })}
      </div>
    </div>
  );
}

function ProviderCard({
  status,
  models,
  baseUrl,
  onChange,
}: {
  status: ProviderStatus;
  models: string[];
  baseUrl: string;
  onChange: (patch: Partial<AIProviderConfig>) => void;
}) {
  const { provider } = status;
  const [open, setOpen] = useState(status.hasKey);
  const [listUrl, setListUrl] = useState(baseUrl);
  const connected = status.hasKey || (provider.keyOptional && models.length > 0);

  return (
    <div className="rounded-md border">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="w-full flex items-center gap-2 px-3 py-2 text-left cursor-pointer"
      >
        <ChevronRight className={cn("size-3.5 text-muted-foreground transition-transform", open && "rotate-90")} />
        <span className="text-sm font-medium flex-1">{provider.name}</span>
        {status.keyError ? (
          <span className="text-[11px] text-destructive">Key unreadable</span>
        ) : connected ? (
          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-500">
            <Check className="size-3" />
            {status.hasKey ? "Key saved" : "Configured"}
          </span>
        ) : (
          <span className="text-[11px] text-muted-foreground">Not set up</span>
        )}
      </button>
      {open && (
        <div className="space-y-3 px-3 pb-3 pl-8">
          {provider.note && <p className="text-[11px] text-muted-foreground">{provider.note}</p>}
          <KeyField status={status} />
          {provider.customUrl && (
            <div className="space-y-1">
              <Label htmlFor={`${provider.id}-url`} className="text-xs text-muted-foreground">
                Server URL
              </Label>
              <Input
                id={`${provider.id}-url`}
                value={baseUrl}
                placeholder={provider.defaultBaseUrl}
                onChange={(e) => onChange({ baseUrl: e.target.value })}
                onBlur={() => setListUrl(baseUrl)}
                className="h-7 text-xs font-mono"
                spellCheck={false}
              />
            </div>
          )}
          <ModelSelect
            provider={provider.id}
            url={listUrl}
            enabled={status.hasKey || provider.keyOptional}
            models={models}
            onChange={(next) => onChange({ models: next })}
          />
        </div>
      )}
    </div>
  );
}
