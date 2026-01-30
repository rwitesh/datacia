import { ConnectionHealthIndicator } from "./ConnectionHealth";
import { ConnectionSwitcher } from "./ConnectionSwitcher";
import { AppUpdate } from "@/shared/AppUpdate/AppUpdate";
import { AppLicense } from "@/shared/AppLicense/AppLicense";

export const EditorFooter = () => {
  return (
    <div className="flex items-center justify-between px-5 py-1 bg-background text-xs text-muted-foreground w-full cursor-default gap-1.5 min-h-6">
      {/* Left side - Connection Health and Switcher */}
      <div className="flex items-center gap-3">
        <ConnectionHealthIndicator />
        <ConnectionSwitcher />

        <div className="h-3 w-px bg-border" />

        {/* License Status Indicator */}
        <AppLicense />
      </div>

      {/* Update Status */}
      <AppUpdate />
    </div>
  );
};
