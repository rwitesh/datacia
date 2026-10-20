import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { Usage } from "@/services/ai";

function formatTokens(n: number) {
  return n < 1000 ? String(n) : n < 9950 ? `${(n / 1000).toFixed(1)}k` : `${Math.round(n / 1000)}k`;
}

// Green once most input is cached, amber when some is; otherwise `low`.
function cacheColor(percent: number, low: string) {
  if (percent >= 60) return "text-emerald-500";
  if (percent >= 20) return "text-amber-500";
  return low;
}

/** A ring filled to the cache hit rate. */
function Ring({ percent, className }: { percent: number; className?: string }) {
  const r = 6;
  const length = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 16 16" className={cn("size-3.5 -rotate-90", className)} aria-hidden>
      <circle cx="8" cy="8" r={r} fill="none" stroke="currentColor" strokeOpacity={0.2} strokeWidth={2.5} />
      <circle
        cx="8"
        cy="8"
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeDasharray={length}
        strokeDashoffset={length * (1 - percent / 100)}
        className="transition-[stroke-dashoffset] duration-500"
      />
    </svg>
  );
}

/** The last reply's context size and cache hit rate; details on hover. */
export function UsageMeter({ usage }: { usage: Usage }) {
  const percent = usage.prompt > 0 ? Math.round((usage.cacheRead / usage.prompt) * 100) : 0;
  // Some providers report no usage.
  if (usage.context === 0) return null;

  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={`${formatTokens(usage.context)} tokens of context, ${percent}% from cache`}
          className="flex shrink-0 cursor-default items-center gap-1 rounded-md px-1.5 h-6 text-[11px] text-muted-foreground tabular-nums hover:bg-muted/60 transition-colors"
        >
          <Ring percent={percent} className={cacheColor(percent, "text-muted-foreground")} />
          {formatTokens(usage.context)}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="w-56 px-3 py-2.5 text-[11px]">
        <p className="mb-2 font-medium">Last reply</p>
        <div className="mb-1 flex justify-between">
          <span className="opacity-70">Cache hit</span>
          <span className="tabular-nums font-medium">{percent}%</span>
        </div>
        <div className="mb-2.5 h-1.5 overflow-hidden rounded-full bg-current/15">
          <div
            className={cn("h-full rounded-full bg-current transition-[width] duration-500", cacheColor(percent, "text-current"))}
            style={{ width: `${percent}%` }}
          />
        </div>
        <dl className="space-y-0.5 tabular-nums">
          {[
            ["Context", usage.context],
            ["Input", usage.prompt],
            ["From cache", usage.cacheRead],
            ["Output", usage.output],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between">
              <dt className="opacity-70">{label}</dt>
              <dd>{Number(value).toLocaleString()} tokens</dd>
            </div>
          ))}
        </dl>
      </TooltipContent>
    </Tooltip>
  );
}
