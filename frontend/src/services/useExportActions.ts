import type { RefObject } from "react";
import html2canvaspro from "html2canvas-pro";
import { useTheme } from "@/components/theme";
import { useExportData, type ExportFormat } from "./export";
import { useCopyToClipboard } from "./clipboard";
import { formatCellValue } from "@/lib/utils";

type UseExportActionsOptions = {
  tableRef?: RefObject<HTMLDivElement | null>;
  data: Record<string, unknown>[];
  columns: string[];
  tableName?: string;
};

export function useExportActions({
  tableRef,
  data,
  columns,
  tableName,
}: UseExportActionsOptions) {
  const { resolvedTheme } = useTheme();
  const exportMutation = useExportData();
  const copyMutation = useCopyToClipboard();

  const pngBackgroundColor = resolvedTheme === "dark" ? "#0f0f10" : "#ffffff";

  const getFilename = (format: ExportFormat) => {
    const count = data.length;
    const base = tableName || "export";
    return count > 1
      ? `${base}-${count}-rows.${format}`
      : `${base}-row.${format}`;
  };

  const exportJSON = () => {
    if (!data.length) return;
    exportMutation.mutate({
      format: "json",
      data,
      columns,
      suggestedFilename: getFilename("json"),
    });
  };

  const exportCSV = () => {
    if (!data.length) return;
    exportMutation.mutate({
      format: "csv",
      data,
      columns,
      suggestedFilename: getFilename("csv"),
    });
  };

  const exportPNG = async () => {
    if (!data.length || !tableRef?.current) return;

    try {
      const canvas = await html2canvaspro(tableRef.current, {
        backgroundColor: pngBackgroundColor,
        scale: 2,
      });
      const dataUrl = canvas.toDataURL("image/png");
      const base64Data = dataUrl.replace(/^data:image\/png;base64,/, "");
      exportMutation.mutate({
        format: "png",
        suggestedFilename: getFilename("png"),
        imageData: base64Data,
      });
    } catch (err) {
      console.error("Export PNG failed:", err);
    }
  };

  const copyText = () => {
    if (!data.length) return;
    const text = data
      .map((row) => columns.map((column) => tsvField(formatCellValue(row[column]))).join("\t"))
      .join("\n");
    copyMutation.mutate(
      { content: text, type: "text" },
      { onError: (err) => console.error("Failed to copy text", err) }
    );
  };

  const copyJSON = () => {
    if (!data.length) return;
    copyMutation.mutate(
      { content: JSON.stringify(data, null, 2), type: "text" },
      { onError: (err) => console.error("Failed to copy JSON", err) }
    );
  };

  const copyPNG = async () => {
    if (!data.length || !tableRef?.current) return;

    try {
      const canvas = await html2canvaspro(tableRef.current, {
        backgroundColor: pngBackgroundColor,
        scale: 2,
      });
      const dataUrl = canvas.toDataURL("image/png");
      const base64Data = dataUrl.replace(/^data:image\/png;base64,/, "");
      copyMutation.mutate(
        { content: base64Data, type: "image" },
        { onError: (err) => console.error("Failed to copy PNG", err) }
      );
    } catch (err) {
      console.error("Copy PNG failed:", err);
    }
  };

  return {
    exportJSON,
    exportCSV,
    exportPNG,
    copyText,
    copyJSON,
    copyPNG,
    isExporting: exportMutation.isPending,
    isCopying: copyMutation.isPending,
  };
}

// tsvField quotes a value the way spreadsheets expect when pasting tab-separated text.
function tsvField(text: string) {
  return /[\t\n\r"]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
