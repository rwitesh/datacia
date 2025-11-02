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
import { useNavigate } from "react-router";

export function MenuBar() {
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();

  const DisconnectHandler = async () => {
    try {
      await Close();
      // Redirect to home after successful disconnection
      navigate("/");
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error("Error disconnecting:", error.message);
      } else {
        console.error("Unknown error disconnecting:", error);
      }
    }
  };

  return (
    <Menubar className="border-none bg-transparent">
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
          <MenubarSeparator />
          <MenubarItem
            className="cursor-pointer text-xs"
            onClick={DisconnectHandler}
          >
            Disconnect
          </MenubarItem>
        </MenubarContent>
      </MenubarMenu>
    </Menubar>
  );
}
