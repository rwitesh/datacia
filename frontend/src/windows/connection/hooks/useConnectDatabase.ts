import { useMutation } from "@tanstack/react-query";
import {
  Connect,
  EstablishConnection,
} from "@/services/bindings/connection";
import { errorMessage } from "@/lib/utils";
import { useTrustHostKey } from "@/shared/HostKey/HostKeyContext";
import { toConnectionConfig } from "../utils/config";
import type { FormValues, Status } from "../utils/types";

type ConnectByIdArgs = { id: string };
type ConnectByValuesArgs = { values: FormValues };
export type ConnectArgs = ConnectByIdArgs | ConnectByValuesArgs;

export const useConnectDatabase = (opts?: {
  setStatus?: (s: Status) => void;
}) => {
  const trustHostKey = useTrustHostKey();

  return useMutation<void, Error, ConnectArgs, unknown>({
    mutationFn: (payload) =>
      trustHostKey(async (accepted) => {
        if ("id" in payload) {
          await EstablishConnection(payload.id, accepted);
        } else {
          await Connect(toConnectionConfig(payload.values, accepted));
        }
      }),
    onMutate: () => {
      opts?.setStatus?.({ kind: "info", title: "Connecting..." });
    },
    // No invalidation: the backend emits connection-changed once the editor
    // opens, and every window's AppProvider refreshes on it.
    onError: (err) => {
      opts?.setStatus?.({
        kind: "error",
        title: "Connection failed",
        description: errorMessage(err),
      });
    },
  });
};
