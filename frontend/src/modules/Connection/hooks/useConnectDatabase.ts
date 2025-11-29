import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { useAppContext } from "@/modules/Context/App/Index";
import {
  CreateNewConnection as Connect,
  EstablishConnection,
} from "@/services/common";
import type { DatabaseEngine, FormValues, Status } from "../utils/types";

type ConnectByIdArgs = { id: string; engine: string };
type ConnectByValuesArgs = { values: FormValues };
type ConnectArgs = ConnectByIdArgs | ConnectByValuesArgs;

export const useConnectDatabase = (opts?: {
  setStatus?: (s: Status) => void;
}) => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { setEngine } = useAppContext();

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
    onSuccess: (_, variables) => {
      const engine =
        "id" in variables
          ? (variables.engine as DatabaseEngine)
          : variables.values.engine;
      setEngine(engine);
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
