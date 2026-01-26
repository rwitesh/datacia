import { Download, AlertCircle, Loader2, CheckCircle2 } from "lucide-react";
import { useCheckForUpdates, useUpdateApp, useRestartApp } from "@/services/updates";

export const AppUpdate = () => {
    const { data: updateAvailable, error: checkError, isLoading: checkLoading } = useCheckForUpdates();
    const {
        mutate: updateApp,
        isPending: isUpdating,
        isError: updateError,
        isSuccess: updateSuccess,
    } = useUpdateApp();

    const handleUpdate = () => {
        updateApp();
    };

    const { mutate: restartApp } = useRestartApp();

    const handleRestart = () => {
        restartApp();
    };

    if (checkLoading) return null;

    return (
        <div className="flex items-center gap-1.5 text-xs">
            {/* Update check failed */}
            {!checkLoading && checkError && (
                <>
                    <AlertCircle className="h-3 w-3 text-destructive" />
                    <span className="text-destructive">{checkError.message}</span>
                </>
            )}

            {/* Update in progress */}
            {!checkLoading && !checkError && isUpdating && (
                <>
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span>Updating...</span>
                </>
            )}

            {/* Update failed */}
            {!checkLoading && !checkError && updateError && (
                <>
                    <AlertCircle className="h-3 w-3 text-destructive" />
                    <span
                        className="text-destructive cursor-pointer underline-offset-2 hover:underline"
                        onClick={handleUpdate}
                    >
                        Update failed. retry?
                    </span>
                </>
            )}

            {/* Update success */}
            {!checkLoading && !checkError && updateSuccess && (
                <>
                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                    <span className="text-green-500">Updated successfully</span>
                    <span className="text-muted-foreground">•</span>
                    <span
                        className="text-blue-500 cursor-pointer hover:underline"
                        onClick={handleRestart}
                    >
                        Restart
                    </span>
                </>
            )}

            {/* Update available */}
            {!checkLoading && !checkError && updateAvailable === true && !isUpdating && !updateSuccess && !updateError && (
                <>
                    <Download
                        className="h-3 w-3 text-blue-500 cursor-pointer"
                        onClick={handleUpdate}
                    />
                    <span className="text-blue-500 cursor-pointer hover:underline" onClick={handleUpdate}>
                        Update available
                    </span>
                </>
            )}
        </div>
    );
};
