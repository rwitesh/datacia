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
import { useTheme, type Theme } from "@/components/theme/theme-provider";
import { Bolt } from "lucide-react";
import { CloseCurrentConnection as Close } from "@/services/common";
import { useAppContext } from "../Context/App/Index";

export function MenuBar() {
  const { theme, setTheme } = useTheme();
  const { metadata } = useAppContext();

  const DisconnectHandler = async () => {
    try {
      await Close();
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error("Error disconnecting:", error.message);
      } else {
        console.error("Unknown error disconnecting:", error);
      }
    }
  };

  return (
    <Menubar className="border-none bg-background">
      <MenubarMenu>
        <MenubarTrigger className="cursor-pointer">
          <Bolt size={18} />
        </MenubarTrigger>
        <MenubarContent className="bg-white dark:bg-zinc-900 min-w-[180px]">
          <MenubarLabel className="text-xs text-muted-foreground px-2 cursor-default select-none">
            Settings
          </MenubarLabel>
          <MenubarSeparator />

          <MenubarSub>
            <MenubarSubTrigger className="cursor-pointer text-xs">
              Appearance
            </MenubarSubTrigger>
            <MenubarSubContent>
              <MenubarRadioGroup
                value={theme}
                onValueChange={(val) => setTheme(val as Theme)}
              >
                <MenubarRadioItem
                  className="cursor-pointer text-xs"
                  value="light"
                >
                  Light
                </MenubarRadioItem>
                <MenubarRadioItem
                  className="cursor-pointer text-xs"
                  value="dark"
                >
                  Dark
                </MenubarRadioItem>
                <MenubarRadioItem
                  className="cursor-pointer text-xs"
                  value="system"
                >
                  System
                </MenubarRadioItem>
              </MenubarRadioGroup>
            </MenubarSubContent>
          </MenubarSub>

          {metadata?.database ? (
            <>
              <MenubarSeparator />
              <MenubarItem
                className="cursor-pointer text-xs"
                onClick={DisconnectHandler}
              >
                Disconnect
              </MenubarItem>
            </>
          ) : (
            <></>
          )}
        </MenubarContent>
      </MenubarMenu>
    </Menubar>
  );
}
