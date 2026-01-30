import { useAppContext } from "@/context/app/Index";
import { useSwitchConnectionMutation } from "@/services/connections";
import { type DatabaseEngine } from "@/shared/utils/engines";
import { toast } from "sonner";

type SwitchConnectionArgs = {
  id: string;
  name: string;
  engine: DatabaseEngine;
};

export const useSwitchConnection = () => {
  const { invalidateConnectionQueries } = useAppContext();
  const mutation = useSwitchConnectionMutation();

  return {
    ...mutation,
    mutate: ({ id, name }: SwitchConnectionArgs) => {
      mutation.mutate(id, {
        onSuccess: () => {
          // Invalidate all connection-specific queries (includes current-connection)
          invalidateConnectionQueries();
          toast.success(`Switched to ${name}`);
        },
        onError: (err) => {
          toast.error("Failed to switch connection", {
            description: err instanceof Error ? err.message : String(err),
          });
        },
      });
    },
  };
};

