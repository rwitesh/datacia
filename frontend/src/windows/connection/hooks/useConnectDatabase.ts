import { useMutation } from "@tanstack/react-query";
import {
  CreateNewConnection as Connect,
  EstablishConnection,
} from "@/services/bindings/connection";
import { errorMessage } from "@/lib/utils";
import type { FormValues, Status } from "../utils/types";

type ConnectByIdArgs = { id: string };
type ConnectByValuesArgs = { values: FormValues };
export type ConnectArgs = ConnectByIdArgs | ConnectByValuesArgs;

export const useConnectDatabase = (opts?: {
  setStatus?: (s: Status) => void;
}) => {
  return useMutation<void, Error, ConnectArgs, unknown>({
    mutationFn: async (payload) => {
      if ("id" in payload) {
        await EstablishConnection(payload.id);
      } else {
        const v = payload.values;
        await Connect(
          v.engine,
          v.host,
          v.port,
          v.username,
          v.password,
          v.database,
          v.useSSH ? "true" : "",
          v.sshHost,
          v.sshPort,
          v.sshUsername,
          v.sshPassword,
          v.useSSHKey ? v.sshKeyPath : "",
          v.sslMode,
          v.sslMode === "verify-full" ? v.sslCAPath : ""
        );
      }
    },
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
