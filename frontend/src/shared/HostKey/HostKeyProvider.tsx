import { useCallback, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { HostKeyContext, unknownHostKey, type TrustHostKey, type UnknownHostKey } from "./HostKeyContext";

type Pending = UnknownHostKey & { settle: (trusted: boolean) => void };

export const HostKeyProvider = ({ children }: { children: ReactNode }) => {
  const [pending, setPending] = useState<Pending | null>(null);

  const settleRef = useRef<((trusted: boolean) => void) | null>(null);

  const confirm = useCallback(
    (key: UnknownHostKey) =>
      new Promise<boolean>((resolve) => {
        // A second prompt replaces the first, which must not stay waiting.
        settleRef.current?.(false);
        const settle = (trusted: boolean) => {
          settleRef.current = null;
          setPending(null);
          resolve(trusted);
        };
        settleRef.current = settle;
        setPending({ ...key, settle });
      }),
    []
  );

  const trustHostKey = useCallback<TrustHostKey>(
    async (connect) => {
      let accepted = "";
      for (;;) {
        try {
          return await connect(accepted);
        } catch (err) {
          const key = unknownHostKey(err);
          if (!key) throw err;
          if (!(await confirm(key))) throw new Error("The SSH host key was not trusted", { cause: err });
          accepted = key.fingerprint;
        }
      }
    },
    [confirm]
  );

  return (
    <HostKeyContext.Provider value={trustHostKey}>
      {children}
      <AlertDialog open={pending !== null} onOpenChange={(open) => !open && pending?.settle(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Trust SSH host?</AlertDialogTitle>
            <AlertDialogDescription>Verify the fingerprint before connecting.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1 text-xs">
            <div className="font-mono select-text break-all">{pending?.host}</div>
            <code className="block rounded bg-muted px-2 py-1 break-all select-text">
              {pending?.fingerprint}
            </code>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button variant="secondary" className="h-6 text-sm">Cancel</Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button className="h-6 text-sm" onClick={() => pending?.settle(true)}>Trust</Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </HostKeyContext.Provider>
  );
};
