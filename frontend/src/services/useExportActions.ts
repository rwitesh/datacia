import type { RefObject } from "react";
import html2canvaspro from "html2canvas-pro";
import { useTheme } from "@/components/theme";
import { useExportData, type ExportFormat } from "./export";
import { useCopyToClipboard } from "./clipboard";
import { toast } from "sonner";
import { errorMessage, formatCellValue } from "@/lib/utils";

type UseExportActionsOptions = {
  tableRef?: RefObject<HTMLDivElement | null>;
  // Read when an action runs, so a large selection is only built on demand.
  source: () => { data: Record<string, unknown>[]; columns: string[] };
  tableName?: string;
};

export function useExportActions({
  tableRef,
  source,
  tableName,
}: UseExportActionsOptions) {
  const { resolvedTheme } = useTheme();
  const exportMutation = useExportData();
  const copyMutation = useCopyToClipboard();

  const pngBackgroundColor = resolvedTheme === "dark" ? "#0f0f10" : "#ffffff";

  const getFilename = (format: ExportFormat, count: number) => {
    const base = tableName || "export";
    return count > 1
      ? `${base}-${count}-rows.${format}`
      : `${base}-row.${format}`;
  };

  const exportJSON = () => {
    const { data, columns } = source();
    if (!data.length) return;
    exportMutation.mutate({
      format: "json",
      data,
      columns,
      suggestedFilename: getFilename("json", data.length),
    });
  };

  const exportCSV = () => {
    const { data, columns } = source();
    if (!data.length) return;
    exportMutation.mutate({
      format: "csv",
      data,
      columns,
      suggestedFilename: getFilename("csv", data.length),
    });
  };

  // capturePNG renders the table to base64 PNG data, or null if there is nothing to capture.
  const capturePNG = async () => {
    if (!source().data.length || !tableRef?.current) return null;
    try {
      const canvas = await html2canvaspro(tableRef.current, {
        backgroundColor: pngBackgroundColor,
        scale: 2,
      });
      return canvas.toDataURL("image/png").replace(/^data:image\/png;base64,/, "");
    } catch (err) {
      toast.error(errorMessage(err));
      return null;
    }
  };

  const exportPNG = async () => {
    const imageData = await capturePNG();
    if (!imageData) return;
    exportMutation.mutate({
      format: "png",
      suggestedFilename: getFilename("png", source().data.length),
      imageData,
    });
  };

  const copyText = () => {
    const { data, columns } = source();
    if (!data.length) return;
    const text = data
      .map((row) => columns.map((column) => tsvField(formatCellValue(row[column]))).join("\t"))
      .join("\n");
    copyMutation.mutate({ content: text, type: "text" });
  };

  const copyJSON = () => {
    const { data } = source();
    if (!data.length) return;
    copyMutation.mutate({ content: JSON.stringify(data, null, 2), type: "text" });
  };

  const copyPNG = async () => {
    const imageData = await capturePNG();
    if (imageData) copyMutation.mutate({ content: imageData, type: "image" });
  };

  return {
    exportJSON,
    exportCSV,
    exportPNG,
    copyText,
    copyJSON,
    copyPNG,
    isExporting: exportMutation.isPending,
  };
}

// tsvField quotes a value the way spreadsheets expect when pasting tab-separated text.
function tsvField(text: string) {
  return /[\t\n\r"]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
