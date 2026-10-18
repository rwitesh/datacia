import { useCallback, useState, type ReactNode } from "react";
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

  const confirm = useCallback(
    (key: UnknownHostKey) =>
      new Promise<boolean>((resolve) => {
        setPending({
          ...key,
          settle: (trusted) => {
            setPending(null);
            resolve(trusted);
          },
        });
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
            <AlertDialogTitle>Trust this SSH host?</AlertDialogTitle>
            <AlertDialogDescription>
              DataCia has not connected to {pending?.host} before. Check that this fingerprint matches
              your server's before continuing.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <code className="rounded bg-muted px-2 py-1 text-xs break-all select-text">
            {pending?.fingerprint}
          </code>
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button variant="secondary" className="h-6 text-sm">Cancel</Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button className="h-6 text-sm" onClick={() => pending?.settle(true)}>Trust and connect</Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </HostKeyContext.Provider>
  );
};
