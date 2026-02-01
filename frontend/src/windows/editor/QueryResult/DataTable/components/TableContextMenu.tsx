import { useRef, useMemo } from "react";
import { Copy, FileJson, FileType, Braces, PanelRight, Crown, Image as ImageIcon } from "lucide-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { useAppContext } from "@/context/app/Index";
import { useExportActions } from "@/services/useExportActions";
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
  const exportRef = useRef<HTMLDivElement>(null);

  const dataToUse = useMemo(() => {
    const selectedData = extractSelectedData(selection, columns, data);
    return selectedData.length > 0 ? selectedData : [row];
  }, [selection, columns, data, row]);

  const {
    exportJSON,
    exportCSV,
    exportPNG,
    copyText,
    copyJSON,
    copyPNG,
  } = useExportActions({
    tableRef: exportRef,
    data: dataToUse,
  });

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
            onSelect={exportJSON}
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
            onSelect={exportCSV}
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
            onSelect={exportPNG}
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
