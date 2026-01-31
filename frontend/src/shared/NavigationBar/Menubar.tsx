import {
  Menubar,
  MenubarMenu,
  MenubarTrigger,
  MenubarContent,
  MenubarLabel,
  MenubarSeparator,
  MenubarSub,
  MenubarSubTrigger,
  MenubarSubContent,
  MenubarRadioGroup,
  MenubarRadioItem,
  MenubarItem,
} from "@/components/ui/menubar";
import { useTheme, type Theme } from "@/components/theme";
import { Bolt, Key, Settings } from "lucide-react";
import { OpenLicenseWindow, OpenSettingsWindow } from "@/services/bindings";
import { useAppContext } from "@/context/app/Index";

export function MenuBar() {
  const { theme, setTheme } = useTheme();
  const { appVersion } = useAppContext();

  return (
    <Menubar className="border-none bg-transparent">
      <MenubarMenu>
        <MenubarTrigger className="cursor-pointer" title="Settings">
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
            className="cursor-pointer text-xs flex items-center gap-2"
            onSelect={(e) => {
              e.preventDefault();
              OpenLicenseWindow();
            }}
          >
            <Key className="h-3.5 w-3.5" />
            License
          </MenubarItem>

          <MenubarItem
            className="cursor-pointer text-xs flex items-center gap-2"
            onSelect={(e) => {
              e.preventDefault();
              OpenSettingsWindow();
            }}
          >
            <Settings className="h-3.5 w-3.5" />
            Settings
          </MenubarItem>

          {appVersion && (
            <>
              <MenubarSeparator />
              <MenubarLabel className="text-[10px] text-muted-foreground px-2 cursor-default select-none">
                Version {appVersion}
              </MenubarLabel>
            </>
          )}
        </MenubarContent>
      </MenubarMenu>
    </Menubar>
  );
}

