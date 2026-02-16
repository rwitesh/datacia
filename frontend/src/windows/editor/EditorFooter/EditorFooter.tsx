import { Sparkles } from "lucide-react";
import { ConnectionHealthIndicator } from "./ConnectionHealth";
import { ConnectionSwitcher } from "./ConnectionSwitcher";
import { AppUpdate } from "@/shared/AppUpdate/AppUpdate";
import { AppLicense } from "@/shared/AppLicense/AppLicense";

interface EditorFooterProps {
  onToggleAI: () => void;
  aiActive: boolean;
}

export const EditorFooter = ({ onToggleAI, aiActive }: EditorFooterProps) => {
  return (
    <div className="flex items-center justify-between px-5 py-1 text-xs text-muted-foreground w-full cursor-default gap-1.5 min-h-6">
      {/* Left side - Connection Health and Switcher */}
      <div className="flex items-center gap-3">
        <ConnectionHealthIndicator />
        <ConnectionSwitcher />

        <div className="h-3 w-px bg-border" />

        {/* License Status Indicator */}
        <AppLicense />
      </div>

      <div className="flex items-center gap-3">
        <AppUpdate />
        <button
          type="button"
          onClick={onToggleAI}
          className={`flex items-center gap-1 cursor-pointer transition-colors ${aiActive ? "text-primary" : "hover:text-foreground"}`}
        >
          <Sparkles className="h-3 w-3" />
          <span>AI</span>
        </button>
      </div>
    </div>
  );
};
