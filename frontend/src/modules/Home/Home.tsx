import { useNavigate, Outlet } from "react-router";
import { DeleteConnection, EstablishConnection } from "@/services/common";
import {
  Plus,
  MoreHorizontal,
  Pencil,
  Plug,
  Trash2,
  Database,
} from "lucide-react";
import {
  Menubar,
  MenubarMenu,
  MenubarTrigger,
  MenubarContent,
  MenubarItem,
  MenubarLabel,
  MenubarSeparator,
} from "@/components/ui/menubar";
import { useFetchConnections } from "@/services/hooks";
import { toast } from "sonner";

export const Home = () => {
  const navigate = useNavigate();

  const {
    data: savedConnections = [],
    isLoading,
    isError,
    refetch,
  } = useFetchConnections();

  const handleDelete = (name: string) => {
    DeleteConnection(name)
      .then((res: boolean) => {
        if (res) refetch();
      })
      .catch((err) => {
        console.error("failed to delete connection:", err);
      });
  };

  const handleConnect = async (name: string) => {
    try {
      await EstablishConnection(name);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : String(error));
    }

  };

  return (
    <div className="flex min-h-screen min-w-screen">
      {/* Left panel: saved connections */}
      <div className="w-1/3 p-3 flex flex-col">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold">Connections</h3>

          {/* + button with dropdown */}
          <Menubar className="border-none bg-transparent h-0">
            <MenubarMenu>
              <MenubarTrigger className="cursor-pointer p-0.5 rounded hover:bg-muted">
                <Plus size={14} />
              </MenubarTrigger>
              <MenubarContent className="bg-white dark:bg-zinc-900 min-w-[150px]">
                <MenubarLabel className="text-[10px] text-muted-foreground px-2 cursor-default select-none">
                  Add Connection
                </MenubarLabel>
                <MenubarSeparator />
                <MenubarItem
                  className="cursor-pointer text-[11px]"
                  onClick={() => navigate("/connect/clickhouse")}
                >
                  ClickHouse
                </MenubarItem>
              </MenubarContent>
            </MenubarMenu>
          </Menubar>
        </div>

        {isLoading ? (
          <div className="text-xs text-muted-foreground">Loading…</div>
        ) : isError ? (
          <div className="text-xs text-red-500">Failed to load connections</div>
        ) : savedConnections.length > 0 ? (
          <ul className="text-xs">
            {savedConnections.map((name) => (
              <li
                key={name}
                className="flex items-center justify-between rounded hover:bg-muted"
              >
                <div className="flex items-center gap-1 min-w-0">
                  <Database className="h-3 w-3 shrink-0 text-muted-foreground" />
                  <span className="truncate">{name}</span>
                </div>

                {/* Per-connection menu */}
                <Menubar className="border-none bg-transparent h-min">
                  <MenubarMenu>
                    <MenubarTrigger className="cursor-pointer p-0.5 rounded hover:bg-accent">
                      <MoreHorizontal className="w-3.5 h-3.5" />
                    </MenubarTrigger>
                    <MenubarContent className="bg-white dark:bg-zinc-900 min-w-[120px]">
                      <MenubarItem
                        className="cursor-pointer text-[11px]"
                        onClick={() => handleConnect(name)}
                      >
                        <Plug className="w-3 h-3 mr-1" />
                        Connect
                      </MenubarItem>
                      <MenubarItem
                        className="cursor-pointer text-[11px]"
                        onClick={() =>
                          navigate(
                            `/connect/clickhouse?name=${encodeURIComponent(
                              name
                            )}`
                          )
                        }
                      >
                        <Pencil className="w-3 h-3 mr-1" />
                        Edit
                      </MenubarItem>
                      <MenubarItem
                        className="cursor-pointer text-[11px] text-red-500"
                        onClick={() => handleDelete(name)}
                      >
                        <Trash2 className="w-3 h-3 mr-1" />
                        Delete
                      </MenubarItem>
                    </MenubarContent>
                  </MenubarMenu>
                </Menubar>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex-1 flex justify-center text-muted-foreground text-xs">
            No saved connections yet
          </div>
        )}
      </div>

      <div className="flex-1 p-3">
        <Outlet />
      </div>
    </div>
  );
};
