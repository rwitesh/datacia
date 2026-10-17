import { useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Browser, CancelError, type CancellablePromise } from "@wailsio/runtime";
import { ExternalLink, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { errorMessage } from "@/lib/utils";
import { SignIn, type ProviderStatus } from "@/services/ai";

type Props = {
  status: ProviderStatus;
  /** Unsaved change: a new key, "" to remove the saved one, undefined for none. */
  change?: string;
  onChange: (change: string | undefined) => void;
};

const linkClass = "text-[11px] text-primary hover:underline cursor-pointer disabled:opacity-50 disabled:no-underline";

export function KeyField({ status, change, onChange }: Props) {
  const { provider } = status;
  const id = `${provider.id}-key`;
  const removing = change === "";
  const signIn = useSignIn(provider.id);

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <Label htmlFor={id} className="text-xs text-muted-foreground">
          API key{provider.keyOptional && " (optional)"}
        </Label>
        {provider.keyUrl && (
          <button type="button" onClick={() => void Browser.OpenURL(provider.keyUrl)} className={`inline-flex items-center gap-1 ${linkClass}`}>
            Get a key
            <ExternalLink className="size-3" />
          </button>
        )}
      </div>
      {removing ? (
        <p className="flex h-7 items-center gap-2 text-xs text-muted-foreground">
          Key will be removed.
          <button type="button" onClick={() => onChange(undefined)} className={linkClass}>
            Undo
          </button>
        </p>
      ) : (
        <div className="relative">
          <Input
            id={id}
            type="password"
            value={change ?? ""}
            onChange={(e) => onChange(e.target.value.trim() === "" ? undefined : e.target.value)}
            placeholder={status.hasKey ? "Saved" : "Paste your API key"}
            autoComplete="off"
            spellCheck={false}
            className="h-7 pr-16 text-xs font-mono"
          />
          {status.hasKey && change === undefined && (
            <button
              type="button"
              onClick={() => onChange("")}
              className="absolute inset-y-0 right-2 text-[11px] text-muted-foreground hover:text-destructive cursor-pointer"
            >
              Remove
            </button>
          )}
        </div>
      )}
      {provider.signIn && !status.hasKey && change === undefined && (
        <p className="flex items-center gap-2 text-[11px] text-muted-foreground">
          {signIn.pending ? (
            <>
              <Loader2 className="size-3 animate-spin" />
              Waiting for browser…
              <button type="button" onClick={signIn.cancel} className={linkClass}>
                Cancel
              </button>
            </>
          ) : (
            <>
              or
              <button type="button" onClick={signIn.start} className={linkClass}>
                sign in with {provider.name}
              </button>
            </>
          )}
        </p>
      )}
      {status.keyError && <p className="text-[11px] text-destructive">{status.keyError}</p>}
      {signIn.error && <p className="text-[11px] text-destructive">{signIn.error}</p>}
    </div>
  );
}

// Sign-in stores the key itself, so it takes effect without saving.
function useSignIn(providerId: string) {
  const queryClient = useQueryClient();
  const call = useRef<CancellablePromise<void> | null>(null);
  const cancel = () => {
    call.current?.cancel();
  };
  useEffect(() => cancel, []);

  const { mutate, isPending, error } = useMutation({
    mutationFn: () => (call.current = SignIn(providerId)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ai-providers"] }),
  });

  return {
    pending: isPending,
    error: error && !(error instanceof CancelError) ? errorMessage(error) : "",
    start: () => mutate(),
    cancel,
  };
}
