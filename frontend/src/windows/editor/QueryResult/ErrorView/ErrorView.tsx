import { AlertTriangle } from "lucide-react";

type ErrorViewProps = {
    error: string;
};

export function ErrorView({ error }: ErrorViewProps) {
    return (
        <div className="w-full h-full bg-red-50 dark:bg-red-900/10 p-6 overflow-y-auto">
            <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
                    <AlertTriangle className="w-6 h-6" />
                    <h3 className="text-lg font-medium">Query Execution Failed</h3>
                </div>

                <div className="font-mono text-sm text-red-900 dark:text-red-200 whitespace-pre-wrap break-all leading-relaxed bg-red-100/50 dark:bg-red-950/30 p-4 rounded-md border border-red-200 dark:border-red-800/30">
                    {error}
                </div>
            </div>
        </div>
    );
}
