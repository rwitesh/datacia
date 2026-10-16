import { Settings } from "lucide-react";
import { OpenSettingsWindow } from "@/services/bindings";
import { AppUpdate } from "@/shared/AppUpdate/AppUpdate";



export const StatusBar = ({ showUpdate = true }: {showUpdate?: boolean}) => {
  return (
    <div className="flex items-center justify-end gap-3 px-3 py-2 border-b border-muted/50">
      <div className="flex items-center gap-3">
        {showUpdate && <AppUpdate />}
        <button
          onClick={() => OpenSettingsWindow("")}
          className="flex items-center gap-1 p-1.5 rounded text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors cursor-pointer"
          title="Settings"
        >
          <Settings className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
