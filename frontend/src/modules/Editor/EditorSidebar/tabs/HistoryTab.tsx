import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { useEditorContext } from "@/modules/Context/Editor/Index";
import { useGetQueryHistory } from "@/services/hooks";
import { timeAgo } from "../utils";
import type { QueryHistoryItem } from "@/services/database";

export function HistoryTab() {
  const { createTab, updateTab, activeTab } = useEditorContext();
  const { data: queryHistory, isLoading: isHistoryLoading } = useGetQueryHistory();

  const handleHistoryClick = (sql: string) => {
    if (activeTab) {
      updateTab(activeTab.id, { sql });
    } else {
      const tab = createTab("Query", "query");
      updateTab(tab.id, { sql });
    }
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      {isHistoryLoading ? (
        <div className="px-4 py-2 text-xs text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Loading history...</span>
        </div>
      ) : !queryHistory || queryHistory.length === 0 ? (
        <div className="px-4 py-2 text-xs text-muted-foreground">
          No query history found
        </div>
      ) : (
        <div className="flex flex-col px-1">
          {queryHistory.map((item: QueryHistoryItem) => (
            <button
              key={item.id}
              className="w-full text-left px-3 py-1.5 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground group transition-colors duration-200 cursor-pointer m-0 rounded-none first:rounded-t-md last:rounded-b-md"
              onClick={() => handleHistoryClick(item.query)}
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <div className="flex items-center gap-1.5">
                  {item.status === "success" ? (
                    <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />
                  ) : (
                    <XCircle className="h-3 w-3 text-red-500 shrink-0" />
                  )}
                  <span className="text-[10px] text-muted-foreground font-medium group-hover:text-sidebar-accent-foreground/70 transition-colors">
                    {timeAgo(item.timestamp)}
                  </span>
                  {item.count > 1 && (
                    <span className="ml-1 px-1.5 py-0.5 rounded-full bg-sidebar-accent text-[9px] font-bold text-sidebar-accent-foreground">
                      x{item.count}
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-muted-foreground tabular-nums group-hover:text-sidebar-accent-foreground/70 transition-colors">
                  {item.duration_ms}ms
                </span>
              </div>
              <div className="text-xs font-mono text-foreground/90 line-clamp-10 break-all group-hover:text-sidebar-accent-foreground transition-colors">
                {item.query}
              </div>
              {item.error_message && (
                <div className="mt-1 text-[10px] text-red-400 line-clamp-1">
                  {item.error_message}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
