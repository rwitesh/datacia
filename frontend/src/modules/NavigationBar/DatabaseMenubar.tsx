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
import { ChangeDatabase, FetchDatabases } from "../../../wailsjs/go/database/ClickHouse";
import { useEffect, useState } from "react";
import { useAppContext } from "@/modules/Context/AppContext";
import { Database } from "lucide-react";

export function DatabaseMenuBar() {
 const [databases, setDatabases] = useState<string[]>([]);
  const { database, setDatabase } = useAppContext();

  const changeDatabaseHandler = (db: string) => async () => {
    try {
      await ChangeDatabase(db);
      setDatabase(db);
    } catch (error) {
      console.error("Failed to change database:", error);
    }
  };

  useEffect(() => {
    FetchDatabases()
      .then(setDatabases)
      .catch((err) => console.error("Failed to fetch databases:", err));
  }, []);

  return (
    <Menubar className="border-none bg-background">
      <MenubarMenu>
        <MenubarTrigger className="cursor-pointer"><Database size={16}/></MenubarTrigger>
        <MenubarContent className="bg-white dark:bg-zinc-900 min-w-[180px]">
          <MenubarLabel className="text-xs text-muted-foreground px-2">Open Database</MenubarLabel>
          <MenubarSeparator />
          <MenubarRadioGroup value={database} onValueChange={(db) => changeDatabaseHandler(db)()}>
            {databases.map((db) => (
              <MenubarRadioItem className="cursor-pointer text-xs" key={db} value={db}>
                {db}
              </MenubarRadioItem>
            ))}
          </MenubarRadioGroup>
        </MenubarContent>
      </MenubarMenu>
    </Menubar>
  );
}
