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
import { ChangeDatabase } from "@/services/clickhouse";
import { useAppContext } from "@/modules/Context/App/Index";
import { Database } from "lucide-react";
import { useDatabase } from "@/services/hooks";

export function DatabaseMenuBar() {
  const { database, setDatabase } = useAppContext();
  const { data: databases = [] } = useDatabase();

  const changeDatabaseHandler = (db: string) => async () => {
    try {
      await ChangeDatabase(db);
      setDatabase(db);
    } catch (error) {
      console.error("Failed to change database:", error);
    }
  };

  return (
    <Menubar className="border-none bg-background">
      <MenubarMenu>
        <MenubarTrigger className="cursor-pointer">
          <Database size={16} />
        </MenubarTrigger>
        <MenubarContent className="bg-white dark:bg-zinc-900 min-w-[180px]">
          <MenubarLabel className="text-xs text-muted-foreground px-2">
            Open Database
          </MenubarLabel>
          <MenubarSeparator />
          <MenubarRadioGroup
            value={database}
            onValueChange={(db) => changeDatabaseHandler(db)()}
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
