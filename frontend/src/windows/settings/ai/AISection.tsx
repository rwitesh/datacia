import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Settings as AppSettings } from "@/services/settings";
import { Plus, X } from "lucide-react";

const KEY_MASK = "***";
const DEFAULT_GEMINI_MODEL = "gemini-3-flash-preview";

function defaultGeminiModels(models: string[] | undefined): string[] {
  if (models?.length) return models;
  return [DEFAULT_GEMINI_MODEL];
}

type AISectionProps = {
  settings: AppSettings;
  onChange: (settings: AppSettings) => void;
};

export function AISection({ settings, onChange }: AISectionProps) {
  const gemini = settings.ai?.gemini ?? { enabled: false, key: "", models: [] };
  const models = defaultGeminiModels(gemini.models);
  const [keyInput, setKeyInput] = useState("");
  const [touched, setTouched] = useState(false);
  const [newModelInput, setNewModelInput] = useState("");

  const emit = (next: AppSettings["ai"]) => {
    onChange({ ...settings, ai: next });
  };

  const keyForSave = () => (touched ? keyInput : gemini.key);

  const setModels = (next: string[]) => {
    emit({ gemini: { ...gemini, key: keyForSave(), models: next } });
  };

  const addModel = () => {
    const v = newModelInput.trim();
    if (!v || models.includes(v)) return;
    setModels([...models, v]);
    setNewModelInput("");
  };

  const removeModel = (modelId: string) => {
    setModels(models.filter((m) => m !== modelId));
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold">AI</h3>
        <p className="text-xs text-muted-foreground">
          Set an API key to use it in the AI chat.
        </p>
      </div>
      <div className="rounded-md border p-3 space-y-3">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="ai-gemini-enabled"
            checked={gemini.enabled}
            onChange={(e) =>
              emit({
                gemini: { ...gemini, enabled: e.target.checked, key: keyForSave(), models },
              })
            }
            className={cn(
              "h-4 w-4 rounded border-input bg-background text-primary",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              "cursor-pointer"
            )}
          />
          <Label htmlFor="ai-gemini-enabled" className="text-sm font-medium cursor-pointer">
            Enable Gemini
          </Label>
        </div>
        {gemini.enabled && (
          <div className="space-y-1 pl-6">
            <Label htmlFor="ai-gemini-key" className="text-xs text-muted-foreground">
              API Key
            </Label>
            <Input
              id="ai-gemini-key"
              type="password"
              placeholder={gemini.key === KEY_MASK ? "••••••••••••" : "AIza..."}
              value={touched ? keyInput : ""}
              onChange={(e) => {
                const v = e.target.value;
                setTouched(true);
                setKeyInput(v);
                emit({ gemini: { ...gemini, key: v, models } });
              }}
              className="h-6 text-xs font-mono"
              autoComplete="off"
            />
          </div>
        )}
        {gemini.enabled && (
          <div className="space-y-2 pl-6">
            <Label className="text-xs text-muted-foreground">Models</Label>
            <ul className="space-y-1.5">
              {models.map((modelId) => (
                <li
                  key={modelId}
                  className="flex items-center gap-2 rounded border border-input bg-background px-2 py-1.5 text-xs font-mono"
                >
                  <span className="min-w-0 flex-1 truncate">{modelId}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-2 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => removeModel(modelId)}
                    aria-label={`Remove ${modelId}`}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </li>
              ))}
            </ul>
            <div className="flex gap-1.5">
              <Input
                type="text"
                placeholder="e.g. gemini-2.0-flash"
                value={newModelInput}
                onChange={(e) => setNewModelInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addModel())}
                className="h-6 flex-1 text-xs font-mono"
              />
              <Button type="button" variant="outline" size="sm" onClick={addModel} className="h-6 shrink-0 cursor-pointer">
                <Plus className="size-3" />
                Add
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
