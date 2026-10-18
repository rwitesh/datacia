import {
  Menubar,
  MenubarMenu,
  MenubarTrigger,
  MenubarContent,
  MenubarLabel,
  MenubarSeparator,
  MenubarRadioGroup,
  MenubarRadioItem,
} from "@/components/ui/menubar";
import { ChangeDatabaseByName } from "@/services/bindings/connection";
import { Database } from "lucide-react";
import { errorMessage } from "@/lib/utils";
import { useDatabase } from "@/services/database";
import { toast } from "sonner";

export function DatabaseMenuBar() {
  const { data: databaseInfo } = useDatabase();
  const databases = databaseInfo?.databases || [];
  const currentDatabase = databaseInfo?.currentDatabase || "";

  // The backend emits connection-changed on success, which refreshes the
  // databases and tables.
  const changeDatabase = async (db: string) => {
    if (db === currentDatabase) return;
    try {
      await ChangeDatabaseByName(db);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  return (
    <Menubar className="border-none bg-transparent">
      <MenubarMenu>
        <MenubarTrigger
          className="cursor-pointer"
          disabled={databases.length === 0}
          title="Open Database"
        >
          <Database
            size={16}
            className={
              databases.length === 0
                ? "opacity-40 grayscale"
                : "text-foreground"
            }
          />
        </MenubarTrigger>
        <MenubarContent className="bg-white dark:bg-zinc-900 min-w-[180px]">
          <MenubarLabel className="text-xs text-muted-foreground px-2">
            Open Database
          </MenubarLabel>
          <MenubarSeparator />
          <MenubarRadioGroup
            value={currentDatabase}
            onValueChange={changeDatabase}
          >
            {databases.map((db) => (
              <MenubarRadioItem
                className="cursor-pointer text-xs"
                key={db}
                value={db}
              >
                {db}
              </MenubarRadioItem>
            ))}
          </MenubarRadioGroup>
        </MenubarContent>
      </MenubarMenu>
    </Menubar>
  );
}
