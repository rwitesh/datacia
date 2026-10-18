import { useAppContext } from "@/context/app/Index";
import { useSwitchConnectionMutation } from "@/services/connections";
import { toast } from "sonner";
import { errorMessage } from "@/lib/utils";

type SwitchConnectionArgs = {
  id: string;
  name: string;
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
            description: errorMessage(err),
          });
        },
      });
    },
  };
};

