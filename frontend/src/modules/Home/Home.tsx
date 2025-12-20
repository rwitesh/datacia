import { useMemo } from "react";
import { useNavigate, Outlet, useLocation } from "react-router";
import { DeleteConnection } from "@/services/common";
import { useFetchConnections } from "@/services/hooks";
import { useConnectDatabase } from "@/modules/Connection/hooks/useConnectDatabase";
import { ConnectionList } from "./ConnectionList/ConnectionList";

export const Home = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const connectMutation = useConnectDatabase();

  // Get the current connection ID from URL query params
  const currentConnectionId = useMemo(() => {
    try {
      const params = new URLSearchParams(location.search);
      return params.get("id") ?? "";
    } catch {
      return "";
    }
  }, [location.search]);

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
      .catch((err) => {
        console.error("failed to delete connection:", err);
      });
  };

  const handleConnect = (id: string, engine: string) => {
    const connection = savedConnections[id];
    const name = connection?.name || "Unknown Connection";
    connectMutation.mutate({ id, name, engine });
  };

  const handleEdit = (id: string) => {
    navigate(`/connect?id=${encodeURIComponent(id)}`);
  };

  return (
    <div className="flex min-h-screen min-w-screen select-none cursor-default bg-background dark:bg-transparent">
      <ConnectionList
        savedConnections={savedConnections}
        currentConnectionId={currentConnectionId}
        isLoading={isLoading}
        isError={isError}
        onDelete={handleDelete}
        onConnect={handleConnect}
        onEdit={handleEdit}
      />

      <div className="flex-1 p-3 border-l border-muted dark:bg-muted">
        <Outlet />
      </div>
    </div>
  );
};