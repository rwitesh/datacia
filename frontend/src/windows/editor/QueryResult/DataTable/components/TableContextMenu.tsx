import { useEffect, useRef, useState } from "react";
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
  // selects the cell it lands on first, so this is what was clicked.
  rows: DataRow[];
  columns: string[];
  onOpenDataView?: () => void;
}

export function TableContextMenu({ children, rows, columns, onOpenDataView }: TableContextMenuProps) {
  const exportRef = useRef<HTMLDivElement>(null);
  // A PNG action waiting for the off-screen table it captures to render.
  // That table only exists during a capture, since a selection can be large.
  const [pendingCapture, setPendingCapture] = useState<(() => Promise<void>) | null>(null);
  const { exportJSON, exportCSV, exportPNG, copyText, copyJSON, copyPNG } = useExportActions({
    tableRef: exportRef,
    data: rows,
    columns,
  });

  useEffect(() => {
    if (!pendingCapture) return;
    pendingCapture().finally(() => setPendingCapture(null));
  }, [pendingCapture]);

  const handleContextMenu = (event: React.MouseEvent) => {
    const onCell = (event.target as HTMLElement).closest("[data-row]");
    if (!onCell || rows.length === 0) event.preventDefault();
  };

  const items = [
    { label: "Open DataView", icon: PanelRight, onSelect: onOpenDataView },
    { label: "Copy", icon: Copy, onSelect: copyText },
    { label: "Copy as JSON", icon: Braces, onSelect: copyJSON },
    { label: "Copy as PNG", icon: ImageIcon, onSelect: () => setPendingCapture(() => copyPNG) },
    { label: "Export as JSON", icon: FileJson, onSelect: exportJSON },
    { label: "Export as CSV", icon: FileType, onSelect: exportCSV },
    { label: "Export as PNG", icon: ImageIcon, onSelect: () => setPendingCapture(() => exportPNG) },
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

      {pendingCapture && (
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
