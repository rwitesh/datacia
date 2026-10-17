import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { errorMessage } from "@/lib/utils";
import { ExportDataToFile } from "./bindings/files";

export type ExportFormat = "csv" | "json" | "png";

export function useExportData() {
    return useMutation({
        mutationFn: async ({
            format,
            data,
            columns = [],
            suggestedFilename,
            imageData // optional, used for png
        }: {
            format: ExportFormat;
            data?: Record<string, unknown>[];
            columns?: string[];
            suggestedFilename: string;
            imageData?: string;
        }) => {
            let dataToSend: string;
            if (format === "png") {
                if (!imageData) throw new Error("Image data required for PNG export");
                dataToSend = imageData;
            } else {
                if (!data) throw new Error("Data required for text export");
                // Rows from Go have their keys sorted; rebuild them in column order.
                const orderedRows = data.map((row) =>
                    Object.fromEntries(columns.map((column) => [column, row[column]]))
                );
                dataToSend = JSON.stringify(orderedRows);
            }
            return ExportDataToFile(format, dataToSend, columns, suggestedFilename);
        },
        onError: (err) => toast.error(errorMessage(err)),
    });
}
