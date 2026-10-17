import { ExportDataToFile as WExportDataToFile } from "../../../bindings/datacia/internal/files/fileservice";

/**
 * Export data to a file with the given format (csv, json or png)
 * @param format - "csv", "json" or "png"
 * @param data - JSON string of the rows, or base64 image data for png
 * @param columns - column order for csv
 * @param suggestedFilename - default filename suggestion
 * @returns The path of the saved file, or empty string if cancelled
 */
export async function ExportDataToFile(
  format: string,
  data: string,
  columns: string[],
  suggestedFilename: string
): Promise<string> {
  if (!format?.trim()) {
    throw new Error("Format cannot be empty");
  }
  if (!data?.trim()) {
    throw new Error("Data cannot be empty");
  }
  if (!suggestedFilename?.trim()) {
    throw new Error("Filename cannot be empty");
  }
  return WExportDataToFile(format, data, columns, suggestedFilename);
}
