import { useRef, useMemo } from "react";
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
  const exportRef = useRef<HTMLDivElement>(null);

  const dataToUse = useMemo(() => {
    const selectedData = extractSelectedData(selection, columns, data);
    return selectedData.length > 0 ? selectedData : [row];
  }, [selection, columns, data, row]);

  const { exportJSON, exportCSV, exportPNG, copyText, copyJSON, copyPNG } =
    useExportActions({
      tableRef: exportRef,
      data: dataToUse,
    });

  const displayColumns = dataToUse.length > 0 ? Object.keys(dataToUse[0]) : [];

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
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
            onSelect={copyPNG}
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
            onSelect={exportPNG}
            className="gap-2 text-xs py-1"
          >
            <div className="flex items-center gap-2">
              <ImageIcon className="h-3 w-3" />
              Export as PNG
            </div>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

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
