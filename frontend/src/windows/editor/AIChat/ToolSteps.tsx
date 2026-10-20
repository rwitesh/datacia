import { useState } from "react";
import { AlertTriangle, ChevronRight, Database, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { QueryPreview, ToolUse } from "@/services/ai";
import { CodeBlock } from "./MarkdownMessage";

/** What the model read to answer, in call order. `streaming` is false once the reply ended. */
export function ToolSteps({ tools, streaming, wide }: { tools: ToolUse[]; streaming: boolean; wide: boolean }) {
  return (
    <div className={cn("space-y-1.5", wide ? "mb-3 text-xs" : "mb-2 text-[11px]")}>
      {tools.map((t, i) =>
        t.sql ? (
          <QueryStep key={t.id || i} tool={t} running={streaming && !t.done} wide={wide} />
        ) : (
          <div key={t.id || i} className="flex items-center gap-1.5 text-muted-foreground">
            <StepIcon running={streaming && !t.done} error={t.error} />
            <span className="truncate">{t.label}</span>
            {t.error && <span className="truncate text-destructive">{t.error}</span>}
          </div>
        ),
      )}
    </div>
  );
}

function StepIcon({ running, error }: { running: boolean; error?: string }) {
  if (running) return <Loader2 className="size-3 shrink-0 animate-spin" />;
  if (error) return <AlertTriangle className="size-3 shrink-0 text-destructive" />;
  return <Database className="size-3 shrink-0" />;
}

/** A query the model ran, with the rows it got back. Open by default in AI mode. */
function QueryStep({ tool, running, wide }: { tool: ToolUse; running: boolean; wide: boolean }) {
  const [open, setOpen] = useState(wide);
  const result = tool.result;
  const summary = result
    ? `${result.rows.length.toLocaleString()}${result.more_rows ? "+" : ""} ${result.rows.length === 1 ? "row" : "rows"} · ${result.ms} ms`
    : undefined;

  return (
    <div className="rounded-md border border-border/60 bg-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center gap-1.5 px-2 py-1.5 text-left text-muted-foreground hover:text-foreground cursor-pointer"
      >
        <ChevronRight className={cn("size-3 shrink-0 transition-transform", open && "rotate-90")} />
        <StepIcon running={running} error={tool.error} />
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
                  <td key={c} className="max-w-72 truncate px-2 py-0.5 align-top" title={typeof v === "string" ? v : undefined}>
                    {formatCell(v)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {result.more_rows && (
        <p className="mt-1 px-1 text-[10px] text-muted-foreground">
          The AI read only these rows. Open the query in a tab to see them all.
        </p>
      )}
    </div>
  );
}
