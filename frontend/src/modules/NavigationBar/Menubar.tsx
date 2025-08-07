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
import { Close } from "../../../wailsjs/go/database/ClickHouse";
import { useTheme, type Theme } from "@/components/theme/theme-provider";

export function MenuBar() {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();

  const DisconnectHandler = async () => {
    try {
      await Close();
    } catch (error) {
      // handle/log error
    } finally {
      navigate("/connect/clickhouse");
    }
  };

  return (
    <Menubar className="border-none bg-background">
      <MenubarMenu>
        <MenubarTrigger className="cursor-pointer">Settings</MenubarTrigger>
        <MenubarContent className="bg-white dark:bg-zinc-900 min-w-[180px]">
          <MenubarLabel className="text-xs text-muted-foreground px-2">My Account</MenubarLabel>
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
          <MenubarSeparator />
          <MenubarItem className="cursor-pointer text-xs" onClick={DisconnectHandler}>Disconnect</MenubarItem>
        </MenubarContent>
      </MenubarMenu>
    </Menubar>
  );
}
