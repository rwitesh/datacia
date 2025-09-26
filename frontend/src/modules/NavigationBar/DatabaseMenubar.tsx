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
import { toast } from "sonner";

export function DatabaseMenuBar() {
  const { metadata } = useAppContext();
  const { data: databases = [] } = useDatabase();

  const changeDatabaseHandler = (db: string) => async () => {
    try {
      await ChangeDatabase(
        metadata.host,
        metadata.port,
        metadata.username,
        metadata.password,
        db
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
      console.error("Failed to change database:", error);
    }
  };

  return (
    <Menubar className="border-none bg-transparent">
      <MenubarMenu>
        <MenubarTrigger
          className="cursor-pointer"
          disabled={databases.length == 0}
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
