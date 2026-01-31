import { useRef, useMemo } from "react";
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
import { type SelectionGeometry, extractSelectedData } from "../utils/cellSelection";

interface TableContextMenuProps {
  children: React.ReactNode;
  row: DataRow;
  selection: SelectionGeometry | null;
  columns: string[];
  data: DataRow[];
  onOpenDataView?: () => void;
}

export function TableContextMenu({
  children,
  row,
  selection,
  columns,
  data,
  onOpenDataView,
}: TableContextMenuProps) {
  const { isLicenseActive } = useAppContext();

  const dataToUse = useMemo(() => {
    const selectedData = extractSelectedData(selection, columns, data);
    return selectedData.length > 0 ? selectedData : [row];
  }, [selection, columns, data, row]);

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
        backgroundColor: "#ffffff",
        scale: 2,
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

  const displayColumns = dataToUse.length > 0 ? Object.keys(dataToUse[0]) : [];

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
        <ContextMenuContent className="w-48 p-1">
          <ContextMenuItem onSelect={onOpenDataView} className="gap-2 text-xs py-1">
            <PanelRight className="h-3 w-3" />
            Open DataView
          </ContextMenuItem>

          <ContextMenuItem onSelect={handleCopyText} className="gap-2 text-xs py-1">
            <Copy className="h-3 w-3" />
            Copy
          </ContextMenuItem>
          <ContextMenuItem onSelect={handleCopyJSON} className="gap-2 text-xs py-1">
            <Braces className="h-3 w-3" />
            Copy as JSON
          </ContextMenuItem>
          <ContextMenuItem
            onSelect={handleCopyPng}
            disabled={!isLicenseActive}
            className="gap-2 text-xs py-1 justify-between"
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
            className="gap-2 text-xs py-1 justify-between"
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
            className="gap-2 text-xs py-1 justify-between"
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
            className="gap-2 text-xs py-1 justify-between"
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
                  {displayColumns.map(c => (
                    <th key={c} className="border p-1 bg-gray-100 font-semibold">{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dataToUse.map((r, i) => (
                  <tr key={i}>
                    {displayColumns.map(c => (
                      <td key={c} className="border p-1 whitespace-pre-wrap">{String(r[c] ?? "")}</td>
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
