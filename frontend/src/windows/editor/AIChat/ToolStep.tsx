import { memo, useState } from "react";
import { AlertTriangle, ChevronRight, Database } from "lucide-react";
import { cn } from "@/lib/utils";
import type { QueryPreview, ToolUse } from "@/services/ai";
import { CodeBlock } from "./MarkdownMessage";

/** One thing the model did while answering; queries also show what they returned. */
export const ToolStep = memo(function ToolStep({ tool, running, wide }: { tool: ToolUse; running: boolean; wide: boolean }) {
  if (tool.sql) return <QueryStep tool={tool} running={running} wide={wide} />;
  return (
    <div className={cn("flex items-center gap-1.5 text-muted-foreground", wide ? "text-xs" : "text-[11px]", running && "animate-pulse")}>
      <StepIcon error={tool.error} />
      <span className="truncate">{tool.label}</span>
      {tool.error && (
        <span className="truncate text-destructive" title={tool.error}>
          {tool.error}
        </span>
      )}
    </div>
  );
});

function StepIcon({ error }: { error?: string }) {
  return error ? (
    <AlertTriangle className="size-3 shrink-0 text-destructive" />
  ) : (
    <Database className="size-3 shrink-0" />
  );
}

/** A query the model ran, with the rows it got back. Open by default in AI mode. */
function QueryStep({ tool, running, wide }: { tool: ToolUse; running: boolean; wide: boolean }) {
  const [open, setOpen] = useState(wide);
  const result = tool.result;
  const summary = result
    ? `${result.rows.length.toLocaleString()}${result.more_rows ? "+" : ""} ${result.rows.length === 1 ? "row" : "rows"} · ${result.ms} ms`
    : undefined;

  return (
    <div className={cn("rounded-md border border-border/60 bg-card overflow-hidden", wide ? "text-xs" : "text-[11px]")}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className={cn(
          "flex w-full items-center gap-1.5 px-2 py-1.5 text-left text-muted-foreground hover:text-foreground cursor-pointer",
          running && "animate-pulse",
        )}
      >
        <ChevronRight className={cn("size-3 shrink-0 transition-transform", open && "rotate-90")} />
        <StepIcon error={tool.error} />
        <span className="truncate">{tool.label}</span>
        {summary && <span className="ml-auto shrink-0 tabular-nums">{summary}</span>}
      </button>
      {open && (
        <div className="space-y-2 border-t border-border/60 p-2">
          <CodeBlock code={tool.sql ?? ""} language="sql" />
          {tool.error && <p className="break-words text-destructive">{tool.error}</p>}
          {result && <ResultPreview result={result} />}
        </div>
      )}
    </div>
  );
}

function cellTitle(value: unknown) {
  if (value === null || value === undefined) return undefined;
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

function formatCell(value: unknown) {
  if (value === null || value === undefined) return <span className="italic text-muted-foreground">NULL</span>;
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

/** The rows exactly as the model read them: capped, with long values cut. */
function ResultPreview({ result }: { result: QueryPreview }) {
  if (result.rows.length === 0) return <p className="px-1 text-muted-foreground">No rows.</p>;
  return (
    <div>
      <div className="max-h-80 overflow-auto rounded border border-border/60 select-text">
        <table className="w-full border-collapse font-mono text-[11px]">
          <thead className="sticky top-0 bg-muted">
            <tr>
              {result.columns.map((c, i) => (
                <th key={i} className="border-b border-border/60 px-2 py-1 text-left font-semibold whitespace-nowrap">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.rows.map((row, r) => (
              <tr key={r} className="even:bg-muted/30">
                {row.map((v, c) => (
                  <td key={c} className="px-2 py-0.5 align-top">
                    {/* Table cells ignore max-width, so the cap is on a div. */}
                    <div className="max-w-72 truncate" title={cellTitle(v)}>
                      {formatCell(v)}
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {result.more_rows && (
        <p className="mt-1 px-1 text-[10px] text-muted-foreground">
          The AI read only these rows. Use "Open in new tab" above to see them all.
        </p>
      )}
    </div>
  );
}
