import type { RefObject } from "react";
import html2canvaspro from "html2canvas-pro";
import { useExportData, type ExportFormat } from "./export";
import { useCopyToClipboard } from "./clipboard";

type UseExportActionsOptions = {
  tableRef?: RefObject<HTMLDivElement | null>;
  data: Record<string, unknown>[];
  tableName?: string;
};

export function useExportActions({
  tableRef,
  data,
  tableName,
}: UseExportActionsOptions) {
  const exportMutation = useExportData();
  const copyMutation = useCopyToClipboard();

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
      suggestedFilename: getFilename("json"),
    });
  };

  const exportCSV = () => {
    if (!data.length) return;
    exportMutation.mutate({
      format: "csv",
      data,
      suggestedFilename: getFilename("csv"),
    });
  };

  const exportPNG = async () => {
    if (!data.length || !tableRef?.current) return;

    try {
      const canvas = await html2canvaspro(tableRef.current, {
        backgroundColor: "#ffffff",
        scale: 2,
      });
      const base64 = canvas.toDataURL("image/png");
      exportMutation.mutate({
        format: "png",
        suggestedFilename: getFilename("png"),
        imageData: base64,
      });
    } catch (err) {
      console.error("Export PNG failed:", err);
    }
  };

  const copyText = () => {
    if (!data.length) return;
    const text = data.map((d) => Object.values(d).join("\t")).join("\n");
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
        backgroundColor: "#ffffff",
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
