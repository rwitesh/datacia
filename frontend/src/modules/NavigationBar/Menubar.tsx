import { useState } from "react";
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
import { useTheme, type Theme } from "@/components/theme/theme-provider";
import { Bolt, Key } from "lucide-react";
import { LicenseDialog } from "@/modules/License/LicenseDialog";

export function MenuBar() {
  const { theme, setTheme } = useTheme();
  const [isLicenseDialogOpen, setIsLicenseDialogOpen] = useState(false);

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
              setIsLicenseDialogOpen(true);
            }}
          >
            <Key className="h-3.5 w-3.5" />
            License
          </MenubarItem>
        </MenubarContent>
      </MenubarMenu>
      <LicenseDialog open={isLicenseDialogOpen} onOpenChange={setIsLicenseDialogOpen} />
    </Menubar>
  );
}
