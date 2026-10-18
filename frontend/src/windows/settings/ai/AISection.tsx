import { useState } from "react";
import { Check, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn, errorMessage, omitKey } from "@/lib/utils";
import { useAIProviders, type ProviderStatus } from "@/services/ai";
import type { AIProviderConfig, KeyChanges, Settings as AppSettings } from "@/services/settings";
import { KeyField } from "./KeyField";

type Props = {
  settings: AppSettings;
  onChange: (settings: AppSettings) => void;
  keys: KeyChanges;
  onKeysChange: (keys: KeyChanges) => void;
};

export function AISection({ settings, onChange, keys, onKeysChange }: Props) {
  const { data: providers, error } = useAIProviders();
  const configs = settings.ai?.providers ?? {};

  // Empty configs are dropped so undoing every edit leaves nothing to save.
  const update = (id: string, patch: Partial<AIProviderConfig>) => {
    const next = { baseUrl: "", ...configs[id], ...patch };
    const nextConfigs = next.baseUrl ? { ...configs, [id]: next } : omitKey(configs, id);
    onChange({ ...settings, ai: { ...settings.ai, providers: nextConfigs } });
  };

  const setKey = (id: string, key: string | undefined) => {
    onKeysChange(key === undefined ? omitKey(keys, id) : { ...keys, [id]: key });
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold">Providers</h3>
        <p className="text-xs text-muted-foreground">Keys are encrypted and stay on this computer.</p>
      </div>
      {error && <p className="text-xs text-destructive">{errorMessage(error)}</p>}
      <div className="space-y-2">
        {providers?.map((p) => (
          <ProviderCard
            key={p.provider.id}
            status={p}
            config={configs[p.provider.id]}
            keyChange={keys[p.provider.id]}
            onChange={(patch) => update(p.provider.id, patch)}
            onKeyChange={(key) => setKey(p.provider.id, key)}
          />
        ))}
      </div>
    </div>
  );
}

function ProviderCard({
  status,
  config,
  keyChange,
  onChange,
  onKeyChange,
}: {
  status: ProviderStatus;
  config?: AIProviderConfig;
  keyChange?: string;
  onChange: (patch: Partial<AIProviderConfig>) => void;
  onKeyChange: (key: string | undefined) => void;
}) {
  const { provider } = status;
  const baseUrl = config?.baseUrl ?? "";
  const [open, setOpen] = useState(false);

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
        ) : status.ready ? (
          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-500">
            <Check className="size-3" />
            Connected
          </span>
        ) : (
          <span className="text-[11px] text-muted-foreground">Not set up</span>
        )}
      </button>
      {/* Hidden rather than unmounted, so collapsing doesn't cancel a sign-in. */}
      <div className={cn("space-y-3 px-3 pb-3 pl-8", !open && "hidden")}>
        <KeyField status={status} change={keyChange} onChange={onKeyChange} />
        {provider.customUrl && (
          <div className="space-y-1">
            <Label htmlFor={`${provider.id}-url`} className="text-xs text-muted-foreground">
              Server URL
            </Label>
            <Input
              id={`${provider.id}-url`}
              value={baseUrl}
              placeholder={`e.g. ${provider.defaultBaseUrl}`}
              onChange={(e) => onChange({ baseUrl: e.target.value })}
              className="h-7 text-xs font-mono"
              spellCheck={false}
            />
          </div>
        )}
      </div>
    </div>
  );
}
