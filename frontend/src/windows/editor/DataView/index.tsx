import { useMemo, useState } from "react";
import { Copy, Check, Lock } from "lucide-react";
import { useAppContext } from "@/context/app/Index";
import { useEditorContext } from "@/context/editor/Index";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { OpenLicenseWindow } from "@/services/bindings";
import { extractSelectedData } from "../QueryResult/DataTable/utils/cellSelection";
import { AIChat } from "./ai";
import { DataTabContent } from "./data";

export type DataViewTab = "data" | "ai";

export interface DataViewProps {
  activeTab?: DataViewTab;
  onTabChange?: (tab: DataViewTab) => void;
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
    if (selectedData.length === 0) return [];
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

  const handleTabChange = (v: string) => onTabChange?.(v as DataViewTab);

  const activeTabValue = controlledTab ?? "data";
  const showDataActivationOverride = !isLicenseActive && activeTabValue === "data";

  return (
    <div className="h-full w-full flex flex-col relative">
      <Tabs
        value={activeTabValue}
        onValueChange={handleTabChange}
        className="h-full flex flex-col gap-0"
      >
        <div className="flex items-center justify-between px-1 py-1 border-b border-border/50">
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
          <DataTabContent lines={lines} disabled={!isLicenseActive} />
        </TabsContent>

        <TabsContent value="ai" className="flex-1 overflow-hidden mt-0">
          <AIChat />
        </TabsContent>
      </Tabs>

      {showDataActivationOverride && (
        <div className="absolute top-8 left-0 right-0 bottom-0 flex flex-col items-center justify-center bg-background/80 z-[5]">
          <div className="flex flex-col items-center gap-4 p-6 text-center max-w-sm">
            <div className="rounded-full bg-primary/10 p-4">
              <Lock className="w-8 h-8 text-primary" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">Upgrade Required</h3>
              <p className="text-sm text-muted-foreground">
                Activate with license to access the Data tab.
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
