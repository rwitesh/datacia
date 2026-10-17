import { useRef, useMemo, useState } from "react";
import {
  Copy,
  FileJson,
  FileType,
  Braces,
  PanelRight,
  Image as ImageIcon,
} from "lucide-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { useExportActions } from "@/services/useExportActions";
import type { DataRow } from "../types";
import {
  type SelectionGeometry,
  extractSelectedData,
} from "../utils/cellSelection";

interface TableContextMenuProps {
  children: React.ReactNode;
  selection: SelectionGeometry | null;
  columns: string[];
  // Rows in view order; data-row attributes index into these.
  data: DataRow[];
  onOpenDataView?: () => void;
}

// One menu for the whole grid body. The right-clicked row is read from the
// cell's data-row attribute, and the export data (plus the hidden table used
// for PNG) only exists while the menu is open or a PNG capture is running.
export function TableContextMenu({
  children,
  selection,
  columns,
  data,
  onOpenDataView,
}: TableContextMenuProps) {
  const [rowIndex, setRowIndex] = useState<number | null>(null);
  const openRef = useRef(false);
  const pngPendingRef = useRef(false);

  const handleContextMenu = (event: React.MouseEvent) => {
    const cell = (event.target as HTMLElement).closest<HTMLElement>("[data-row]");
    const index = cell ? Number(cell.dataset.row) : NaN;
    if (!(index >= 0 && index < data.length)) {
      // Blank and filler rows have no menu.
      event.preventDefault();
      return;
    }
    setRowIndex(index);
  };

  const handleOpenChange = (open: boolean) => {
    openRef.current = open;
    if (!open && !pngPendingRef.current) setRowIndex(null);
  };

  const runPNG = async (action: () => Promise<void>) => {
    pngPendingRef.current = true;
    try {
      await action();
    } finally {
      pngPendingRef.current = false;
      if (!openRef.current) setRowIndex(null);
    }
  };

  return (
    <ContextMenu onOpenChange={handleOpenChange}>
      <ContextMenuTrigger asChild onContextMenu={handleContextMenu}>
        {children}
      </ContextMenuTrigger>
      {rowIndex !== null && data[rowIndex] && (
        <RowMenu
          row={data[rowIndex]}
          selection={selection}
          columns={columns}
          data={data}
          onOpenDataView={onOpenDataView}
          runPNG={runPNG}
        />
      )}
    </ContextMenu>
  );
}

interface RowMenuProps {
  row: DataRow;
  selection: SelectionGeometry | null;
  columns: string[];
  data: DataRow[];
  onOpenDataView?: () => void;
  runPNG: (action: () => Promise<void>) => void;
}

function RowMenu({
  row,
  selection,
  columns,
  data,
  onOpenDataView,
  runPNG,
}: RowMenuProps) {
  const exportRef = useRef<HTMLDivElement>(null);

  const dataToUse = useMemo(() => {
    const selectedData = extractSelectedData(selection, columns, data);
    if (selectedData.length > 0) return selectedData;
    // Rows from Go have their keys sorted; list them in column order.
    return [Object.fromEntries(columns.map((column) => [column, row[column]]))];
  }, [selection, columns, data, row]);

  const displayColumns = dataToUse.length > 0 ? Object.keys(dataToUse[0]) : [];

  const { exportJSON, exportCSV, exportPNG, copyText, copyJSON, copyPNG } =
    useExportActions({
      tableRef: exportRef,
      data: dataToUse,
      columns: displayColumns,
    });

  return (
    <>
      <ContextMenuContent className="w-48 p-1">
        <ContextMenuItem
          onSelect={onOpenDataView}
          className="gap-2 text-xs py-1"
        >
          <PanelRight className="h-3 w-3" />
          Open DataView
        </ContextMenuItem>

        <ContextMenuItem onSelect={copyText} className="gap-2 text-xs py-1">
          <Copy className="h-3 w-3" />
          Copy
        </ContextMenuItem>
        <ContextMenuItem onSelect={copyJSON} className="gap-2 text-xs py-1">
          <Braces className="h-3 w-3" />
          Copy as JSON
        </ContextMenuItem>
        <ContextMenuItem
          onSelect={() => runPNG(copyPNG)}
          className="gap-2 text-xs py-1"
        >
          <div className="flex items-center gap-2">
            <ImageIcon className="h-3 w-3" />
            Copy as PNG
          </div>
        </ContextMenuItem>
        <ContextMenuItem
          onSelect={exportJSON}
          className="gap-2 text-xs py-1"
        >
          <div className="flex items-center gap-2">
            <FileJson className="h-3 w-3" />
            Export as JSON
          </div>
        </ContextMenuItem>
        <ContextMenuItem
          onSelect={exportCSV}
          className="gap-2 text-xs py-1"
        >
          <div className="flex items-center gap-2">
            <FileType className="h-3 w-3" />
            Export as CSV
          </div>
        </ContextMenuItem>
        <ContextMenuItem
          onSelect={() => runPNG(exportPNG)}
          className="gap-2 text-xs py-1"
        >
          <div className="flex items-center gap-2">
            <ImageIcon className="h-3 w-3" />
            Export as PNG
          </div>
        </ContextMenuItem>
      </ContextMenuContent>

      {/* Hidden render container for PNG (copy + export) – uses current theme so no white override */}
      <div
        style={{
          position: "absolute",
          top: -10000,
          left: -10000,
          overflow: "visible",
        }}
      >
        <div
          ref={exportRef}
          className="p-2 min-w-[800px] text-foreground"
        >
          {dataToUse.length > 0 && (
            <table className="w-full text-xs font-mono border-collapse text-foreground">
              <thead>
                <tr>
                  {displayColumns.map((c) => (
                    <th
                      key={c}
                      className="border border-border p-1 font-semibold "
                    >
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dataToUse.map((r, i) => (
                  <tr key={i}>
                    {displayColumns.map((c) => (
                      <td
                        key={c}
                        className="border border-border p-1 whitespace-pre-wrap text-foreground"
                      >
                        {String(r[c] ?? "")}
                      </td>
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
