import { useNavigate, Outlet } from "react-router";
import { DeleteConnection } from "@/services/common";
import ClickhouseIcon from "@/assets/clickhouse.svg";
import PostgreSQLIcon from "@/assets/postgres.svg";
import MySQLIcon from "@/assets/mysql.svg";
import SQLiteIcon from "@/assets/sqlite.svg";
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
import { useConnectDatabase } from "@/modules/Connection/hooks/useConnectDatabase";


export const Home = () => {
  const navigate = useNavigate();

  const connectMutation = useConnectDatabase();

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
    connectMutation.mutate({ id, engine });
  };

  const handleEdit = (id: string) => {
    navigate(`/connect?id=${encodeURIComponent(id)}`);
  };

  return (
    <div className="flex min-h-screen min-w-screen select-none cursor-default bg-background dark:bg-transparent">
      {/* Left panel: saved connections */}
      <div className="w-1/3 p-3 flex flex-col mt-12">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold">Connections</h3>
          {/* + button with dropdown */}
          <Menubar className="border-none bg-transparent h-0">
            <MenubarMenu>
              <MenubarTrigger className="cursor-pointer p-0.5 rounded hover:bg-muted">
                <Plus size={14} />
              </MenubarTrigger>
              <MenubarContent className="bg-white dark:bg-zinc-900 min-w-[150px]">
                <MenubarLabel className="text-[10px] text-muted-foreground px-2 cursor-default">
                  Add Connection
                </MenubarLabel>
                <MenubarSeparator />
                <MenubarItem
                  className="cursor-pointer text-[11px]"
                  onClick={() => navigate("/connect?engine=postgres")}
                >
                  <img src={PostgreSQLIcon} width={11} height={11} className="mr-1" />
                  PostgreSQL
                </MenubarItem>
                <MenubarItem
                  className="cursor-pointer text-[11px]"
                  onClick={() => navigate("/connect?engine=clickhouse")}
                >
                  <img src={ClickhouseIcon} width={11} height={11} className="mr-1" />
                  ClickHouse
                </MenubarItem>
                <MenubarItem
                  className="cursor-pointer text-[11px]"
                  onClick={() => navigate("/connect?engine=mysql")}
                >
                  <img src={MySQLIcon} width={11} height={11} className="mr-1" />
                  MySQL
                </MenubarItem>
                <MenubarItem
                  className="cursor-pointer text-[11px]"
                  onClick={() => navigate("/connect?engine=sqlite")}
                >
                  <img src={SQLiteIcon} width={11} height={11} className="mr-1" />
                  SQLite
                </MenubarItem>
              </MenubarContent>
            </MenubarMenu>
          </Menubar>
        </div>

        {isLoading ? (
          <div className="text-xs text-muted-foreground">Loading…</div>
        ) : isError ? (
          <div className="text-xs text-red-500">Failed to load connections</div>
        ) : Object.keys(savedConnections).length > 0 ? (
          <ul className="text-xs">
            {Object.entries(savedConnections).map(([id, connectionInfo]) => {
              const getConnectionIcon = (engine: string) => {
                if (engine === "clickhouse") {
                  return <img src={ClickhouseIcon} width={12} height={12} className="shrink-0" alt="ClickHouse" />;
                } else if (engine === "postgres") {
                  return <img src={PostgreSQLIcon} width={12} height={12} className="shrink-0" alt="PostgreSQL" />;
                } else if (engine === "mysql") {
                  return <img src={MySQLIcon} width={12} height={12} className="shrink-0" alt="MySQL" />;
                } else if (engine === "sqlite") {
                  return <img src={SQLiteIcon} width={12} height={12} className="shrink-0" alt="SQLite" />;
                } else {
                  return <Database className="h-3 w-3 shrink-0 text-muted-foreground" />;
                }
              };

              return (
                <li
                  key={id}
                  className="flex items-center justify-between rounded select-none px-1"
                >
                  <div className="flex items-center gap-1 min-w-0">
                    {getConnectionIcon(connectionInfo.engine)}
                    <span className="truncate">{connectionInfo.name}</span>
                  </div>

                  {/* Per-connection menu */}
                  <Menubar className="border-none bg-transparent h-min">
                    <MenubarMenu>
                      <MenubarTrigger className="cursor-pointer p-0.5 rounded">
                        <MoreHorizontal className="w-3.5 h-3.5" />
                      </MenubarTrigger>
                      <MenubarContent className="bg-white dark:bg-zinc-900 min-w-[120px]">
                        <MenubarItem
                          className="cursor-pointer text-[11px]"
                          onClick={() => handleConnect(id, connectionInfo.engine)}
                        >
                          <Plug className="w-3 h-3 mr-1" />
                          Connect
                        </MenubarItem>
                        <MenubarItem
                          className="cursor-pointer text-[11px]"
                          onClick={() => handleEdit(id)}
                        >
                          <Pencil className="w-3 h-3 mr-1" />
                          Edit
                        </MenubarItem>
                        <MenubarItem
                          className="cursor-pointer text-[11px] text-red-500"
                          onClick={() => handleDelete(id)}
                        >
                          <Trash2 className="w-3 h-3 mr-1" />
                          Delete
                        </MenubarItem>
                      </MenubarContent>
                    </MenubarMenu>
                  </Menubar>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="flex-1 flex justify-center text-muted-foreground text-xs">
            No saved connections yet
          </div>
        )}
      </div>

      <div className="flex-1 p-3 border-l border-muted dark:bg-background">
        <Outlet />
      </div>
    </div>
  );
};