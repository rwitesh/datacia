// Re-exports for ExportDataToFile
import { ExportDataToFile as WExportDataToFile } from "../../../bindings/datacia/internal/files/fileservice";

/**
 * Export data to a file with the given format (csv or json)
 * @param format - "csv" or "json"
 * @param data - JSON string of data array
 * @param suggestedFilename - default filename suggestion
 * @returns The path of the saved file, or empty string if cancelled
 */
export async function ExportDataToFile(
  format: string,
  data: string,
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
  return WExportDataToFile(format, data, suggestedFilename);
}
