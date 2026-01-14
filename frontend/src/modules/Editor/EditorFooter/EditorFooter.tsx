import { useCheckForUpdates, useUpdateApp } from "@/services/hooks";
import { Download, AlertCircle, Loader2, CheckCircle2 } from "lucide-react";
import { ConnectionHealthIndicator } from "./ConnectionHealth";
import { ConnectionSwitcher } from "./ConnectionSwitcher";

export const EditorFooter = () => {
  const { data, error, isLoading } = useCheckForUpdates();
  const {
    mutate: updateApp,
    isPending: isUpdating,
    isError: updateError,
    isSuccess: updateSuccess,
  } = useUpdateApp();

  const handleUpdate = () => {
    updateApp();
  };

  return (
    <div className="flex items-center justify-between px-5 py-1 bg-background text-xs text-muted-foreground w-full cursor-default gap-1.5 min-h-6">
      {/* Left side - Connection Health and Switcher */}
      <div className="flex items-center gap-3">
        <ConnectionHealthIndicator />
        <ConnectionSwitcher />
      </div>

      {/* Update Status */}
      <div className="flex items-center gap-1.5">
      {/* Update check failed */}
      {!isLoading && error && (
        <>
          <AlertCircle className="h-3 w-3 text-destructive" />
          <span className="text-destructive">{error.message}</span>
        </>
      )}

      {/* Update in progress */}
      {!isLoading && !error && isUpdating && (
        <>
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>Updating...</span>
        </>
      )}

      {/* Update failed */}
      {!isLoading && !error && updateError && (
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
      {!isLoading && !error && updateSuccess && (
        <>
          <CheckCircle2 className="h-3 w-3 text-green-500" />
          <span className="text-green-500">Updated successfully</span>
        </>
      )}

      {/* Update available */}
      {!isLoading && !error && data === true && !isUpdating && !updateSuccess && !updateError && (
        <>
          <Download
            className="h-3 w-3 text-blue-500 cursor-pointer"
            onClick={handleUpdate}
          />
          <span className="text-blue-500 cursor-pointer" onClick={handleUpdate}>
            Update available
          </span>
        </>
      )}
      </div>
    </div>
  );
};
