import { useMutation } from "@tanstack/react-query";
import { ExportDataToFile } from "./bindings/files";

export type ExportFormat = "csv" | "json";

export function useExportData() {
    return useMutation({
        mutationFn: async ({
            format,
            data,
            suggestedFilename
        }: {
            format: ExportFormat;
            data: Record<string, unknown>[];
            suggestedFilename: string;
        }) => {
            return ExportDataToFile(format, JSON.stringify(data), suggestedFilename);
        },
    });
}
