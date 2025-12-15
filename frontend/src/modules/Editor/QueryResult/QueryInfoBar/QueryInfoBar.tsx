import { useEditorContext } from "@/modules/Context/Editor/Index";

function formatExecutionTime(ms: number): string {
  if (ms < 1000) {
    return `${ms} ms`;
  }
  const seconds = (ms / 1000).toFixed(2);
  return `${seconds} s`;
}

export function QueryInfoBar() {
  const { activeTab } = useEditorContext();

  if (!activeTab || !activeTab.results) return null;

  const { results } = activeTab;
  const executionTime = results.executionTime ?? 0;
  const rowCount = results.data?.length ?? 0;
  const columnCount = results.columns?.length ?? 0;

  return (
    <div className="flex items-center justify-between bg-card border-t border-border px-4 py-1.5 text-xs text-muted-foreground select-none">
      <div className="flex items-center gap-4">
        <span>
          <span className="font-medium">Time:</span> {formatExecutionTime(executionTime)}
        </span>
        {results.type === "read" && (
          <>
            <span>
              <span className="font-medium">Rows:</span> {rowCount.toLocaleString()}
            </span>
            <span>
              <span className="font-medium">Columns:</span> {columnCount}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

