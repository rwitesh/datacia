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
import { ChangeDatabaseByName } from "@/services/common";
import { Database } from "lucide-react";
import { useDatabase } from "@/services/hooks";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export function DatabaseMenuBar() {
  const { data: databaseInfo } = useDatabase();
  const queryClient = useQueryClient();
  const databases = databaseInfo?.databases || [];
  const currentDatabase = databaseInfo?.currentDatabase || "";

  const changeDatabaseHandler = (db: string) => async () => {
    try {
        await ChangeDatabaseByName(db);
        // Invalidate the databases query to refresh the current database
        await queryClient.invalidateQueries({ queryKey: ["databases"] });
        // Also invalidate tables query as it depends on the current database
        await queryClient.invalidateQueries({ queryKey: ["tables"] });
        console.log(currentDatabase, db)
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
            value={currentDatabase}
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
