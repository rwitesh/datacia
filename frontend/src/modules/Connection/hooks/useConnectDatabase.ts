import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import {
  CreateNewConnection as Connect,
  EstablishConnection,
} from "@/services/common";
import type { FormValues, Status } from "../utils/types";

type ConnectByIdArgs = { id: string; name: string; engine: string };
type ConnectByValuesArgs = { values: FormValues };
type ConnectArgs = ConnectByIdArgs | ConnectByValuesArgs;

export const useConnectDatabase = (opts?: {
  setStatus?: (s: Status) => void;
}) => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

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
          v.useSSHKey ? v.sshKeyPath : ""
        );
      }
    },
    onMutate: () => {
      opts?.setStatus?.({ kind: "info", title: "Connecting..." });
    },
    onSuccess: () => {
      // Invalidate queries to refetch current connection from backend
      queryClient.invalidateQueries({ queryKey: ["current-connection"] });
      queryClient.invalidateQueries({ queryKey: ["databases"] });
      queryClient.invalidateQueries({ queryKey: ["tables"] });
      navigate("/editor");
    },
    onError: (err) => {
      opts?.setStatus?.({
        kind: "error",
        title: "Connection failed",
        description: err instanceof Error ? err.message : String(err),
      });
    },
  });
};
