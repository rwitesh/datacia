import { Sparkles } from "lucide-react";
import { ConnectionHealthIndicator } from "./ConnectionHealth";
import { ConnectionSwitcher } from "./ConnectionSwitcher";
import { AppUpdate } from "@/shared/AppUpdate/AppUpdate";
import { cn } from "@/lib/utils";

interface EditorFooterProps {
  // Unset in AI mode, where the chat already fills the editor.
  onToggleAI?: () => void;
  aiActive: boolean;
}

export const EditorFooter = ({ onToggleAI, aiActive }: EditorFooterProps) => {
  return (
    <div className="flex items-center justify-between px-5 py-1 text-xs text-muted-foreground w-full cursor-default gap-1.5 min-h-6">
      <div className="flex items-center gap-3">
        <ConnectionHealthIndicator />
        <ConnectionSwitcher />
      </div>

      <div className="flex items-center gap-3">
        <AppUpdate />
        {onToggleAI && (
          <button
            type="button"
            onClick={onToggleAI}
            className={cn(
              "flex items-center gap-1 cursor-pointer transition-colors",
              aiActive ? "text-primary" : "hover:text-foreground"
            )}
          >
            <Sparkles className="h-3 w-3" />
            <span>AI</span>
          </button>
        )}
      </div>
    </div>
  );
};
