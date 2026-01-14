import { Copy, FileJson, FileType, Braces, PanelRight } from "lucide-react";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { FileService, ClipboardService } from "@/services/bindings";
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
  const dataToUse = selectedData.length > 0 ? selectedData : [row];

  const handleCopyText = async () => {
    const text = dataToUse.map((d) => Object.values(d).join("\t")).join("\n");
    await ClipboardService.SetText(text);
  };

  const handleCopyJSON = async () => {
    await ClipboardService.SetText(JSON.stringify(dataToUse, null, 2));
  };

  const handleExportJSON = async () => {
    const defaultName = dataToUse.length > 1
      ? `export-${dataToUse.length}-rows.json`
      : "row-export.json";

    try {
      await FileService.SaveFile(
        defaultName,
        JSON.stringify(dataToUse, null, 2)
      );
    } catch (err) {
      console.error("Failed to save JSON", err);
    }
  };

  const handleExportCSV = async () => {
    if (dataToUse.length === 0) return;

    const headers = Object.keys(dataToUse[0]);
    const headerRow = headers.join(",");
    const rows = dataToUse.map((d) => {
      return headers
        .map((h) => {
          const val = d[h];
          if (val === null || val === undefined) return "";
          const str = String(val);
          if (str.includes(",") || str.includes('"') || str.includes("\n")) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        })
        .join(",");
    });

    const csvContent = [headerRow, ...rows].join("\n");
    const defaultName = dataToUse.length > 1
      ? `export-${dataToUse.length}-rows.csv`
      : "row-export.csv";

    try {
      await FileService.SaveFile(defaultName, csvContent);
    } catch (err) {
      console.error("Failed to save CSV", err);
    }
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        <ContextMenuItem onClick={onOpenDataView} className="gap-2 text-xs">
          <PanelRight className="h-3 w-3" />
          Open DataView
        </ContextMenuItem>

        <ContextMenuItem onClick={handleCopyText} className="gap-2 text-xs">
          <Copy className="h-3 w-3" />
          Copy
        </ContextMenuItem>
        <ContextMenuItem onClick={handleCopyJSON} className="gap-2 text-xs">
          <Braces className="h-3 w-3" />
          Copy as JSON
        </ContextMenuItem>
        <ContextMenuItem onClick={handleExportJSON} className="gap-2 text-xs">
          <FileJson className="h-3 w-3" />
          Export as JSON
        </ContextMenuItem>
        <ContextMenuItem onClick={handleExportCSV} className="gap-2 text-xs">
          <FileType className="h-3 w-3" />
          Export as CSV
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
