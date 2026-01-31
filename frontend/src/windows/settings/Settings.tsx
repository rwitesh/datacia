import { Button } from "@/components/ui/button";
import { Settings as SettingsIcon } from "lucide-react";
import { Window } from "@wailsio/runtime";

export function Settings() {
  const handleClose = () => {
    Window.Close();
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-background text-foreground select-none">
      {/* Draggable title bar area for system buttons */}
      <div
        className="h-12 shrink-0"
        style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
      />

      {/* Content */}
      <div className="flex-1 overflow-auto px-6 pb-6">
        <div className="flex items-center gap-2 mb-2">
          <SettingsIcon className="h-5 w-5" />
          <span className="font-semibold text-lg">Settings</span>
        </div>
        <p className="text-sm text-muted-foreground mb-6">
          Configure application preferences.
        </p>

        {/* Settings List - placeholder */}
        <div className="space-y-1">
          <div className="text-sm text-muted-foreground py-8 text-center">
            Settings coming soon...
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t p-4 shrink-0">
        <Button variant="outline" onClick={handleClose} className="w-full">
          Close
        </Button>
      </div>
    </div>
  );
}
