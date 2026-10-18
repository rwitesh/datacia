import { useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Braces, Copy, FileJson, FileType, Image as ImageIcon, PanelRight } from "lucide-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { formatCellValue } from "@/lib/utils";
import { useExportActions } from "@/services/useExportActions";
import type { DataRow } from "../types";

interface TableContextMenuProps {
  children: React.ReactNode;
  // The selected rows, holding only the selected columns. A right-click
  // selects the cell, row or column it lands on first, so this is what was clicked.
  rows: DataRow[];
  columns: string[];
  onOpenDataView: () => void;
}

export function TableContextMenu({ children, rows, columns, onOpenDataView }: TableContextMenuProps) {
  const exportRef = useRef<HTMLDivElement>(null);
  // The off-screen table a PNG is drawn from only exists during a capture,
  // since a selection can be large.
  const [isCapturing, setIsCapturing] = useState(false);
  const { exportJSON, exportCSV, exportPNG, copyText, copyJSON, copyPNG } = useExportActions({
    tableRef: exportRef,
    data: rows,
    columns,
  });

  const capturePNG = async (action: () => Promise<void>) => {
    // Render the table before the action reads it through exportRef.
    flushSync(() => setIsCapturing(true));
    try {
      await action();
    } finally {
      setIsCapturing(false);
    }
  };

  const handleContextMenu = (event: React.MouseEvent) => {
    const onGridCell = (event.target as HTMLElement).closest("[data-col]");
    if (!onGridCell || rows.length === 0) event.preventDefault();
  };

  const items = [
    { label: "Open DataView", icon: PanelRight, onSelect: onOpenDataView },
    { label: "Copy", icon: Copy, onSelect: copyText },
    { label: "Copy as JSON", icon: Braces, onSelect: copyJSON },
    { label: "Copy as PNG", icon: ImageIcon, onSelect: () => capturePNG(copyPNG) },
    { label: "Export as JSON", icon: FileJson, onSelect: exportJSON },
    { label: "Export as CSV", icon: FileType, onSelect: exportCSV },
    { label: "Export as PNG", icon: ImageIcon, onSelect: () => capturePNG(exportPNG) },
  ];

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild onContextMenu={handleContextMenu}>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48 p-1">
        {items.map(({ label, icon: Icon, onSelect }) => (
          <ContextMenuItem key={label} onSelect={onSelect} className="gap-2 py-1 text-xs">
            <Icon className="h-3 w-3" />
            {label}
          </ContextMenuItem>
        ))}
      </ContextMenuContent>

      {isCapturing && (
        <div className="absolute -left-[10000px] -top-[10000px]">
          <div ref={exportRef} className="min-w-[800px] p-2 text-foreground">
            <table className="w-full border-collapse font-mono text-xs">
              <thead>
                <tr>
                  {columns.map((column) => (
                    <th key={column} className="border border-border p-1 font-semibold">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={index}>
                    {columns.map((column) => (
                      <td key={column} className="whitespace-pre-wrap border border-border p-1">
                        {formatCellValue(row[column])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </ContextMenu>
  );
}
