import { useState } from "react";
import { Copy, FileJson, FileType, Braces, PanelRight, Crown } from "lucide-react";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { useAppContext } from "@/modules/Context/App/Index";
import { LicenseDialog } from "@/modules/License/LicenseDialog";
import { useCopyToClipboard } from "@/services/clipboard";
import { useSaveFile } from "@/services/files";
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
  const [isLicenseDialogOpen, setIsLicenseDialogOpen] = useState(false);
  const dataToUse = selectedData.length > 0 ? selectedData : [row];
  
  const copyToClipboardMutation = useCopyToClipboard();
  const saveFileMutation = useSaveFile();

  const handleCopyText = () => {
    const text = dataToUse.map((d) => Object.values(d).join("\t")).join("\n");
    copyToClipboardMutation.mutate(text, {
      onError: (err) => {
        console.error("Failed to copy text", err);
      },
    });
  };

  const handleCopyJSON = () => {
    copyToClipboardMutation.mutate(JSON.stringify(dataToUse, null, 2), {
      onError: (err) => {
        console.error("Failed to copy JSON", err);
      },
    });
  };

  const handleExportJSON = () => {
    // if (!isLicenseActive) {
    //   setIsLicenseDialogOpen(true);
    //   return;
    // }

    const defaultName = dataToUse.length > 1
      ? `export-${dataToUse.length}-rows.json`
      : "row-export.json";

    saveFileMutation.mutate(
      {
        filename: defaultName,
        content: JSON.stringify(dataToUse, null, 2),
      },
      {
        onError: (err) => {
          console.error("Failed to save JSON", err);
        },
      }
    );
  };

  const handleExportCSV = () => {
    // if (!isLicenseActive) {
    //   setIsLicenseDialogOpen(true);
    //   return;
    // }

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

    saveFileMutation.mutate(
      {
        filename: defaultName,
        content: csvContent,
      },
      {
        onError: (err) => {
          console.error("Failed to save CSV", err);
        },
      }
    );
  };

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
            onSelect={handleExportJSON} 
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
            onSelect={handleExportCSV} 
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
        </ContextMenuContent>
      </ContextMenu>
      <LicenseDialog
        open={isLicenseDialogOpen}
        onOpenChange={setIsLicenseDialogOpen}
      />
    </>
  );
}
