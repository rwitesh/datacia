import {
  Menubar,
  MenubarMenu,
  MenubarTrigger,
  MenubarContent,
  MenubarItem,
  MenubarLabel,
  MenubarSeparator,
  MenubarSub,
  MenubarSubTrigger,
  MenubarSubContent,
  MenubarRadioGroup,
  MenubarRadioItem,
} from "@/components/ui/menubar";
import { useNavigate } from "react-router";
import { useTheme, type Theme } from "@/components/theme/theme-provider";
import { useAppContext } from "../Context/AppContext";
import { Bolt } from "lucide-react";

export function MenuBar() {
  const navigate = useNavigate();
  const { database, closeConnection } = useAppContext();
  const { theme, setTheme } = useTheme();

  const DisconnectHandler = async () => {
    try {
      await closeConnection();
    } catch (error) {
    } finally {
      navigate("/connect/clickhouse");
    }
  };

  return (
    <Menubar className="border-none bg-background">
      <MenubarMenu>
        <MenubarTrigger className="cursor-pointer"><Bolt size={18} /></MenubarTrigger>
        <MenubarContent className="bg-white dark:bg-zinc-900 min-w-[180px]">
          <MenubarLabel className="text-xs text-muted-foreground px-2">Settings</MenubarLabel>
          <MenubarSeparator />

          <MenubarSub >
            <MenubarSubTrigger className="cursor-pointer text-xs">Appearance</MenubarSubTrigger>
            <MenubarSubContent>
              <MenubarRadioGroup
                value={theme}
                onValueChange={(val) => setTheme(val as Theme)}
              >
                <MenubarRadioItem className="cursor-pointer text-xs" value="light">
                  Light
                </MenubarRadioItem>
                <MenubarRadioItem className="cursor-pointer text-xs" value="dark">
                  Dark
                </MenubarRadioItem>
                <MenubarRadioItem className="cursor-pointer text-xs" value="system">
                  System
                </MenubarRadioItem>
              </MenubarRadioGroup>
            </MenubarSubContent>
          </MenubarSub>
          {
            database ?
              <>
                <MenubarSeparator />
                <MenubarItem className="cursor-pointer text-xs" onClick={DisconnectHandler}>Disconnect</MenubarItem>
              </> : <></>
          }
        </MenubarContent>
      </MenubarMenu>
    </Menubar>
  );
}
