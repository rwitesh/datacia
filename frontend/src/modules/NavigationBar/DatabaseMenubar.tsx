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
import { ChangeDatabase } from "@/services/common";
import { Database } from "lucide-react";
import { useDatabase } from "@/services/hooks";
import { useAppContext } from "../Context/App/Index";

export function DatabaseMenuBar() {
  const {metadata} = useAppContext();
  const { data: databases = [] } = useDatabase();

  const changeDatabaseHandler = (db: string) => async () => {
    try {
      await ChangeDatabase(metadata.host, metadata.port, metadata.username, metadata.password, db);
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
            value={metadata?.database}
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
