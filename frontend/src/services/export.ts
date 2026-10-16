import { useMutation } from "@tanstack/react-query";
import { ExportDataToFile } from "./bindings/files";

export type ExportFormat = "csv" | "json" | "png";

export function useExportData() {
    return useMutation({
        mutationFn: async ({
            format,
            data,
            suggestedFilename,
            imageData // optional, used for png
        }: {
            format: ExportFormat;
            data?: Record<string, unknown>[];
            suggestedFilename: string;
            imageData?: string;
        }) => {
            let dataToSend: string;
            if (format === "png") {
                if (!imageData) throw new Error("Image data required for PNG export");
                dataToSend = imageData;
            } else {
                if (!data) throw new Error("Data required for text export");
                dataToSend = JSON.stringify(data);
            }
            return ExportDataToFile(format, dataToSend, suggestedFilename);
        },
    });
}
