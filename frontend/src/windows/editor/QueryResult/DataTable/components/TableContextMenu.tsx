import { useRef } from "react";
import { Copy, FileJson, FileType, Braces, PanelRight, Crown, Image as ImageIcon } from "lucide-react";
import html2canvaspro from "html2canvas-pro";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { useAppContext } from "@/context/app/Index";
import { useCopyToClipboard } from "@/services/clipboard";
import { useExportData, type ExportFormat } from "@/services/export";
import type { DataRow } from "../types";

interface TableContextMenuProps {
  children: React.ReactNode;
  row: DataRow;
  selectedData?: DataRow[];
  onOpenDataView?: () => void;
}

export function TableContextMenu({
  children,
  row,
  selectedData = [],
  onOpenDataView,
}: TableContextMenuProps) {
  const { isLicenseActive } = useAppContext();
  const dataToUse = selectedData.length > 0 ? selectedData : [row];

  const copyToClipboardMutation = useCopyToClipboard();
  const exportDataMutation = useExportData();
  const exportRef = useRef<HTMLDivElement>(null);


  const handleCopyText = () => {
    const text = dataToUse.map((d) => Object.values(d).join("\t")).join("\n");
    copyToClipboardMutation.mutate({ content: text, type: "text" }, {
      onError: (err) => {
        console.error("Failed to copy text", err);
      },
    });
  };

  const handleCopyJSON = () => {
    copyToClipboardMutation.mutate({ content: JSON.stringify(dataToUse, null, 2), type: "text" }, {
      onError: (err) => {
        console.error("Failed to copy JSON", err);
      },
    });
  };

  const handleCopyPng = async () => {
    if (!exportRef.current || dataToUse.length === 0) return;

    try {
      const canvas = await html2canvaspro(exportRef.current, {
        backgroundColor: "#ffffff",
        scale: 2,
      });

      const dataUrl = canvas.toDataURL("image/png");
      // Remove the prefix "data:image/png;base64," to get the raw base64 string
      const base64Data = dataUrl.replace(/^data:image\/png;base64,/, "");

      copyToClipboardMutation.mutate({ content: base64Data, type: "image" }, {
        onError: (err) => {
          console.error("Failed to copy PNG", err);
        },
      });
    } catch (err) {
      console.error("Copy PNG failed:", err);
    }
  };


  const handleExport = (format: ExportFormat) => {
    if (dataToUse.length === 0) return;

    const rowCount = dataToUse.length;
    const suggestedFilename = rowCount > 1
      ? `export-${rowCount}-rows.${format}`
      : `row-export.${format}`;

    exportDataMutation.mutate(
      {
        format,
        data: dataToUse,
        suggestedFilename,
      },
      {
        onError: (err) => {
          console.error(`Failed to export as ${format}:`, err);
        },
      }
    );
  };

  const handleExportPng = async () => {
    if (!exportRef.current || dataToUse.length === 0) return;

    try {
      const canvas = await html2canvaspro(exportRef.current, {
        backgroundColor: "#ffffff", // Ensure white background
        scale: 2, // Higher resolution
      });

      const base64 = canvas.toDataURL("image/png");
      const rowCount = dataToUse.length;
      const filename = rowCount > 1
        ? `export-${rowCount}-rows.png`
        : `row-export.png`;

      exportDataMutation.mutate({
        format: "png",
        suggestedFilename: filename,
        imageData: base64
      });
    } catch (err) {
      console.error("Export PNG failed:", err);
    }
  };


  const columns = dataToUse.length > 0 ? Object.keys(dataToUse[0]) : [];

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
        <ContextMenuContent className="w-48">
          <ContextMenuItem onSelect={onOpenDataView} className="gap-2 text-xs">
            <PanelRight className="h-3 w-3" />
            Open DataView
          </ContextMenuItem>

          <ContextMenuItem onSelect={handleCopyText} className="gap-2 text-xs">
            <Copy className="h-3 w-3" />
            Copy
          </ContextMenuItem>
          <ContextMenuItem onSelect={handleCopyJSON} className="gap-2 text-xs">
            <Braces className="h-3 w-3" />
            Copy as JSON
          </ContextMenuItem>
          <ContextMenuItem
            onSelect={handleCopyPng}
            disabled={!isLicenseActive}
            className="gap-2 text-xs justify-between"
          >
            <div className="flex items-center gap-2">
              <ImageIcon className="h-3 w-3" />
              Copy as PNG
            </div>
            {!isLicenseActive && (
              <Crown className="h-3 w-3 text-amber-500" />
            )}
          </ContextMenuItem>
          <ContextMenuItem
            onSelect={() => handleExport("json")}
            disabled={!isLicenseActive}
            className="gap-2 text-xs justify-between"
          >
            <div className="flex items-center gap-2">
              <FileJson className="h-3 w-3" />
              Export as JSON
            </div>
            {!isLicenseActive && (
              <Crown className="h-3 w-3 text-amber-500" />
            )}
          </ContextMenuItem>
          <ContextMenuItem
            onSelect={() => handleExport("csv")}
            disabled={!isLicenseActive}
            className="gap-2 text-xs justify-between"
          >
            <div className="flex items-center gap-2">
              <FileType className="h-3 w-3" />
              Export as CSV
            </div>
            {!isLicenseActive && (
              <Crown className="h-3 w-3 text-amber-500" />
            )}
          </ContextMenuItem>
          <ContextMenuItem
            onSelect={handleExportPng}
            disabled={!isLicenseActive}
            className="gap-2 text-xs justify-between"
          >
            <div className="flex items-center gap-2">
              <ImageIcon className="h-3 w-3" />
              Export as PNG
            </div>
            {!isLicenseActive && (
              <Crown className="h-3 w-3 text-amber-500" />
            )}
          </ContextMenuItem>

        </ContextMenuContent>
      </ContextMenu>

      {/* Hidden Render Container for PNG Export */}
      <div style={{ position: "absolute", top: -10000, left: -10000, overflow: "visible" }}>
        <div ref={exportRef} className="p-4 bg-white text-black min-w-[800px]">
          {dataToUse.length > 0 && (
            <table className="w-full text-xs font-mono border-collapse">
              <thead>
                <tr>
                  {columns.map(c => (
                    <th key={c} className="border p-1 bg-gray-100 font-semibold">{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dataToUse.map((row, i) => (
                  <tr key={i}>
                    {columns.map(c => (
                      <td key={c} className="border p-1 whitespace-pre-wrap">{String(row[c] ?? "")}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}

