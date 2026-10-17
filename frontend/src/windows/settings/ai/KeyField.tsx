import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Browser, CancelError, type CancellablePromise } from "@wailsio/runtime";
import { ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { errorMessage } from "@/lib/utils";
import { RemoveAPIKey, SetAPIKey, SignIn, type ProviderStatus } from "@/services/ai";

export function KeyField({ status }: { status: ProviderStatus }) {
  const { provider } = status;
  const queryClient = useQueryClient();
  const [key, setKey] = useState("");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [signingIn, setSigningIn] = useState(false);
  const signInCall = useRef<CancellablePromise<void> | null>(null);
  useEffect(
    () => () => {
      signInCall.current?.cancel();
    },
    [],
  );

  const act = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
      setKey("");
      setEditing(false);
      await queryClient.invalidateQueries({ queryKey: ["ai-providers"] });
      await queryClient.invalidateQueries({ queryKey: ["ai-models", provider.id] });
    } catch (err) {
      if (!(err instanceof CancelError)) setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const signIn = () => {
    setSigningIn(true);
    void act(() => (signInCall.current = SignIn(provider.id))).finally(() => {
      signInCall.current = null;
      setSigningIn(false);
    });
  };

  const cancelEdit = () => {
    setEditing(false);
    setKey("");
    setError("");
  };

  const showInput = !status.hasKey || editing;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <Label htmlFor={`${provider.id}-key`} className="text-xs text-muted-foreground">
          API key{provider.keyOptional && " (optional)"}
        </Label>
        {provider.keyUrl && (
          <button
            type="button"
            onClick={() => void Browser.OpenURL(provider.keyUrl)}
            className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline cursor-pointer"
          >
            Get a key
            <ExternalLink className="size-3" />
          </button>
        )}
      </div>
      {showInput ? (
        <form
          className="flex gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            if (key.trim()) void act(() => SetAPIKey(provider.id, key));
          }}
        >
          <Input
            id={`${provider.id}-key`}
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="Paste your API key"
            autoComplete="off"
            spellCheck={false}
            className="h-7 flex-1 text-xs font-mono"
          />
          <Button type="submit" size="sm" variant="outline" disabled={busy || !key.trim()} className="h-7 text-xs cursor-pointer">
            Save key
          </Button>
          {editing && (
            <Button type="button" size="sm" variant="ghost" onClick={cancelEdit} className="h-7 text-xs cursor-pointer">
              Cancel
            </Button>
          )}
        </form>
      ) : (
        <div className="flex items-center gap-1.5">
          <span className="flex-1 text-xs font-mono text-muted-foreground">••••••••••••</span>
          <Button size="sm" variant="outline" onClick={() => setEditing(true)} className="h-7 text-xs cursor-pointer">
            Replace
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() => void act(() => RemoveAPIKey(provider.id))}
            className="h-7 text-xs text-destructive hover:text-destructive cursor-pointer"
          >
            Remove
          </Button>
        </div>
      )}
      {provider.signIn && showInput && (
        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="secondary" disabled={busy} onClick={signIn} className="h-7 text-xs cursor-pointer">
            {signingIn && <Loader2 className="size-3 animate-spin" />}
            Sign in with {provider.name}
          </Button>
          {signingIn && (
            <Button size="sm" variant="ghost" onClick={() => signInCall.current?.cancel()} className="h-7 text-xs cursor-pointer">
              Cancel
            </Button>
          )}
        </div>
      )}
      {status.keyError && <p className="text-[11px] text-destructive">{status.keyError}</p>}
      {error && <p className="text-[11px] text-destructive">{error}</p>}
    </div>
  );
}
