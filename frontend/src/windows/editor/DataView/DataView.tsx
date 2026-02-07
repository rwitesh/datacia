import { useMemo, useState } from "react";
import { Copy, Check, Lock } from "lucide-react";
import { useAppContext } from "@/context/app/Index";
import { useEditorContext } from "@/context/editor/Index";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { OpenLicenseWindow } from "@/services/bindings";
import { extractSelectedData } from "../QueryResult/DataTable/utils/cellSelection";
import { AIChat } from "./AIChat";

function getColorClass(value: string): string {
  if (value === "null") {
    return "text-red-500 dark:text-red-400";
  }

  if (value === "true" || value === "false") {
    return "text-amber-600 dark:text-amber-400";
  }

  if (/^-?\d+\.?\d*$/.test(value.trim())) {
    return "text-blue-600 dark:text-blue-400";
  }

  if (value.startsWith('"') && value.endsWith('"')) {
    return "text-emerald-600 dark:text-emerald-400";
  }

  return "text-muted-foreground";
}

function HighlightedLine({ line }: { line: string }) {
  const parts = line.split(/("(?:[^"\\]|\\.)*")/g);

  return (
    <>
      {parts.map((part, index) => {
        if (!part) return null;

        const nextPart = parts[index + 1] || "";
        const isKey = part.startsWith('"') && nextPart.trim().startsWith(":");

        if (isKey) {
          return (
            <span key={index} className="text-purple-600 dark:text-purple-400">
              {part}
            </span>
          );
        }

        return (
          <span key={index} className={getColorClass(part)}>
            {part}
          </span>
        );
      })}
    </>
  );
}

interface DataViewProps {
  activeTab?: "data" | "ai";
  onTabChange?: (tab: "data" | "ai") => void;
}

export function DataView({ activeTab: controlledTab, onTabChange }: DataViewProps) {
  const [copied, setCopied] = useState(false);
  const { isLicenseActive } = useAppContext();
  const { activeTab } = useEditorContext();

  const selection = activeTab?.selection ?? null;

  const selectedData = useMemo(
    () => extractSelectedData(
      selection,
      activeTab?.results?.columns ?? [],
      activeTab?.results?.data ?? [],
    ),
    [selection, activeTab?.results?.columns, activeTab?.results?.data]
  );

  const lines = useMemo(() => {
    const jsonString = JSON.stringify(selectedData, null, 2);
    const compacted = jsonString.replace(/\},\n\s*\{/g, "}, {");
    return compacted.split("\n");
  }, [selectedData]);

  const handleCopy = async () => {
    try {
      const jsonString = JSON.stringify(selectedData, null, 2);
      await navigator.clipboard.writeText(jsonString);
      setCopied(true);
    } catch {
      // Silently fail
    }
  };

  const rowCount = selectedData.length;

  return (
    <div className="h-full w-full flex flex-col relative">
      <Tabs value={controlledTab ?? "data"} onValueChange={(v) => onTabChange?.(v as "data" | "ai")} className="h-full flex flex-col gap-0">
        <div className={`flex items-center justify-between px-1 py-1 border-b border-border/50 ${!isLicenseActive ? 'blur-sm' : ''}`}>
          <TabsList className="h-6 p-1">
            <TabsTrigger value="data" className="text-xs px-2 h-5 max-w-32 cursor-pointer">
              Data
            </TabsTrigger>
            <TabsTrigger value="ai" className="text-xs px-2 h-5 max-w-32 cursor-pointer">
              AI
            </TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-1">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary/10 text-primary border border-primary/20">
              {rowCount} {rowCount === 1 ? 'row' : 'rows'}
            </span>
            <button
              type="button"
              aria-label="Copy JSON to clipboard"
              title={copied ? "Copied!" : "Copy to clipboard"}
              onClick={handleCopy}
              onPointerLeave={() => setCopied(false)}
              onBlur={() => setCopied(false)}
              className="p-1.5 rounded-md hover:bg-muted transition-all duration-200 group"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-emerald-500 transition-transform duration-200 scale-110" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-colors duration-200" />
              )}
              <span className="sr-only">
                {copied ? "Copied to clipboard" : "Copy JSON"}
              </span>
            </button>
          </div>
        </div>

        <TabsContent value="data" className="flex-1 overflow-auto mt-0">
          <div className={`p-4 ${!isLicenseActive ? 'blur-sm select-none pointer-events-none' : ''}`}>
            <code className="block text-xs font-mono leading-relaxed">
              {lines.map((line, index) => (
                <div key={index} className="whitespace-pre-wrap break-words">
                  <HighlightedLine line={line} />
                </div>
              ))}
            </code>
          </div>
        </TabsContent>

        <TabsContent value="ai" className="flex-1 overflow-hidden mt-0">
          <AIChat />
        </TabsContent>
      </Tabs>

      {!isLicenseActive && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 z-[5]">
          <div className="flex flex-col items-center gap-4 p-6 text-center max-w-sm">
            <div className="rounded-full bg-primary/10 p-4">
              <Lock className="w-8 h-8 text-primary" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">Upgrade Required</h3>
              <p className="text-sm text-muted-foreground">
                Activate with license to access DataView panel.
              </p>
            </div>
            <Button
              onClick={() => OpenLicenseWindow()}
              className="mt-2"
            >
              Activate License
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
