import { useNavigate, Outlet, useSearchParams } from "react-router";
import { toast } from "sonner";
import { DeleteConnection } from "@/services/bindings/connection";
import { useFetchConnections } from "@/services/connections";
import { useConnectDatabase } from "@/windows/connection/hooks/useConnectDatabase";
import { ConnectionList } from "./ConnectionList/ConnectionList";
import { errorMessage } from "@/lib/utils";

export const Home = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const connectMutation = useConnectDatabase();

  const currentConnectionId = searchParams.get("id") ?? "";

  const {
    data: savedConnections = {},
    isLoading,
    isError,
    refetch,
  } = useFetchConnections();

  const handleDelete = (id: string) => {
    DeleteConnection(id)
      .then((res: boolean) => {
        if (res) refetch();
      })
      .catch((err) => toast.error("Failed to delete connection", { description: errorMessage(err) }));
  };

  const handleConnect = (id: string) => {
    connectMutation.mutateAsync({ id }).catch((err) => toast.error(errorMessage(err)));
  };

  const handleEdit = (id: string) => {
    navigate(`/connect?id=${encodeURIComponent(id)}`);
  };

  return (
    <div className={`flex min-h-screen min-w-screen select-none cursor-default bg-card`}>
      <ConnectionList
        savedConnections={savedConnections}
        currentConnectionId={currentConnectionId}
        isLoading={isLoading}
        isError={isError}
        onDelete={handleDelete}
        onConnect={handleConnect}
        onEdit={handleEdit}
      />

      <div className="flex-1 p-3 border-l bg-background">
        <Outlet />
      </div>
    </div>
  );
};