import { useNavigate } from "react-router";
import { ENGINE_LIST } from "@/shared/utils/engines";
import { DatabaseIcon } from "@/shared/utils/DatabaseIcon";
import { Plus, MoreHorizontal, Pencil, Plug, Trash2 } from "lucide-react";
import {
  Menubar,
  MenubarMenu,
  MenubarTrigger,
  MenubarContent,
  MenubarItem,
  MenubarLabel,
  MenubarSeparator,
} from "@/components/ui/menubar";
interface ConnectionInfo {
  name: string;
  engine: string;
}

interface ConnectionListProps {
  savedConnections: Record<string, ConnectionInfo>;
  currentConnectionId: string;
  isLoading: boolean;
  isError: boolean;
  onDelete: (id: string) => void;
  onConnect: (id: string, engine: string) => void;
  onEdit: (id: string) => void;
}

export function ConnectionList({
  savedConnections,
  currentConnectionId,
  isLoading,
  isError,
  onDelete,
  onConnect,
  onEdit,
}: ConnectionListProps) {
  const navigate = useNavigate();
  const connectionEntries = Object.entries(savedConnections);

  return (
    <div className="w-1/3 px-3 flex flex-col mt-10  h-content justify-between">
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold">Connections</h3>
          <AddConnectionMenu onNavigate={(engine) => navigate(`/connect?engine=${engine}`)} />
        </div>

        {isLoading ? (
          <div className="text-xs text-muted-foreground">Loading…</div>
        ) : isError ? (
          <div className="text-xs text-red-500">Failed to load connections</div>
        ) : connectionEntries.length > 0 ? (
          <ul className="text-xs">
            {connectionEntries.map(([id, info]) => (
              <ConnectionRow
                key={id}
                id={id}
                name={info.name}
                engine={info.engine}
                isActive={currentConnectionId === id}
                onEdit={onEdit}
                onConnect={onConnect}
                onDelete={onDelete}
              />
            ))}
          </ul>
        ) : (
          <div className="flex-1 flex justify-center text-muted-foreground text-xs">
            No saved connections yet
          </div>
        )}
      </div>
    </div>
  );
}

// Add Connection dropdown menu - uses ENGINE_LIST from centralized config
function AddConnectionMenu({ onNavigate }: { onNavigate: (engine: string) => void }) {
  return (
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
          {ENGINE_LIST.map((engine) => (
            <MenubarItem
              key={engine.id}
              className="cursor-pointer text-[11px]"
              onClick={() => onNavigate(engine.id)}
            >
              <DatabaseIcon engine={engine.id} size={11} className="mr-1 shrink-0" />
              {engine.label}
            </MenubarItem>
          ))}
        </MenubarContent>
      </MenubarMenu>
    </Menubar>
  );
}

// Individual connection row
interface ConnectionRowProps {
  id: string;
  name: string;
  engine: string;
  isActive: boolean;
  onEdit: (id: string) => void;
  onConnect: (id: string, engine: string) => void;
  onDelete: (id: string) => void;
}

function ConnectionRow({ id, name, engine, isActive, onEdit, onConnect, onDelete }: ConnectionRowProps) {
  return (
    <li
      className={`flex items-center justify-between rounded select-none px-1 cursor-pointer ${isActive ? "bg-muted" : "hover:bg-muted/50"
        }`}
      onClick={() => onEdit(id)}
      onDoubleClick={() => onConnect(id, engine)}
    >
      <div className="flex items-center gap-1 min-w-0 flex-1">
        <DatabaseIcon engine={engine} size={12} />
        <span className="truncate">{name}</span>
      </div>

      <ConnectionActions
        id={id}
        engine={engine}
        onConnect={onConnect}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    </li>
  );
}

// Per-connection action menu
interface ConnectionActionsProps {
  id: string;
  engine: string;
  onConnect: (id: string, engine: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

function ConnectionActions({ id, engine, onConnect, onEdit, onDelete }: ConnectionActionsProps) {
  return (
    <Menubar
      className="border-none bg-transparent h-min"
      onClick={(e) => e.stopPropagation()}
    >
      <MenubarMenu>
        <MenubarTrigger variant="ghost" className="cursor-pointer p-0.5 rounded">
          <MoreHorizontal className="w-3.5 h-3.5" />
        </MenubarTrigger>
        <MenubarContent className="bg-white dark:bg-zinc-900 min-w-[120px]">
          <MenubarItem
            className="cursor-pointer text-[11px]"
            onClick={() => onConnect(id, engine)}
          >
            <Plug className="w-3 h-3 mr-1" />
            Connect
          </MenubarItem>
          <MenubarItem
            className="cursor-pointer text-[11px]"
            onClick={() => onEdit(id)}
          >
            <Pencil className="w-3 h-3 mr-1" />
            Edit
          </MenubarItem>
          <MenubarItem
            className="cursor-pointer text-[11px] text-red-500"
            onClick={() => onDelete(id)}
          >
            <Trash2 className="w-3 h-3 mr-1" />
            Delete
          </MenubarItem>
        </MenubarContent>
      </MenubarMenu>
    </Menubar>
  );
}
