import { useState } from "react";
import { useCheckForUpdates, useUpdateApp } from "@/services/updates";
import { useLicenseStatus } from "@/services/license";
import { Download, AlertCircle, Loader2, CheckCircle2, AlertTriangle, Sparkles } from "lucide-react";
import { ConnectionHealthIndicator } from "./ConnectionHealth";
import { ConnectionSwitcher } from "./ConnectionSwitcher";
import { LicenseDialog } from "@/modules/License/LicenseDialog";

// Helper to check if license is expiring soon (within 30 days)
const isExpiringSoon = (expiresAt?: string): boolean => {
  if (!expiresAt) return false;
  const expiryDate = new Date(expiresAt);
  const now = new Date();
  const daysUntilExpiry = (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  return daysUntilExpiry > 0 && daysUntilExpiry <= 30;
};

// Helper to check if license is expired
const isExpired = (expiresAt?: string): boolean => {
  if (!expiresAt) return false;
  const expiryDate = new Date(expiresAt);
  return new Date() > expiryDate;
};

// Helper to get days until expiry
const getDaysUntilExpiry = (expiresAt?: string): number => {
  if (!expiresAt) return 0;
  const expiryDate = new Date(expiresAt);
  const now = new Date();
  return Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
};

export const EditorFooter = () => {
  const [licenseDialogOpen, setLicenseDialogOpen] = useState(false);

  const { data, error, isLoading } = useCheckForUpdates();
  const { data: licenseStatus } = useLicenseStatus();
  const {
    mutate: updateApp,
    isPending: isUpdating,
    isError: updateError,
    isSuccess: updateSuccess,
  } = useUpdateApp();

  const handleUpdate = () => {
    updateApp();
  };

  // Determine license display state
  const hasLicenseError = licenseStatus?.error;
  const licenseExpired = isExpired(licenseStatus?.expires_at);
  const licenseExpiringSoon = isExpiringSoon(licenseStatus?.expires_at);
  const daysUntilExpiry = getDaysUntilExpiry(licenseStatus?.expires_at);

  const showLicenseWarning = hasLicenseError || licenseExpired || licenseExpiringSoon;
  const isLicenseValid = licenseStatus?.valid === true && !hasLicenseError && !licenseExpired;

  return (
    <div className="flex items-center justify-between px-5 py-1 bg-background text-xs text-muted-foreground w-full cursor-default gap-1.5 min-h-6">
      {/* Left side - Connection Health and Switcher */}
      <div className="flex items-center gap-3">
        <ConnectionHealthIndicator />
        <ConnectionSwitcher />

        {/* License Status Indicator */}
        {showLicenseWarning && (
          <>
            <div className="h-3 w-px bg-border" />
            <div
              className="flex items-center gap-1 cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => setLicenseDialogOpen(true)}
            >
              {hasLicenseError ? (
                <>
                  <AlertCircle className="h-3 w-3 text-destructive" />
                  <span className="text-destructive">{licenseStatus.error}</span>
                </>
              ) : licenseExpired ? (
                <>
                  <AlertCircle className="h-3 w-3 text-destructive" />
                  <span className="text-destructive">License expired</span>
                </>
              ) : licenseExpiringSoon ? (
                <>
                  <AlertTriangle className="h-3 w-3 text-amber-500" />
                  <span className="text-amber-500">
                    License expires in {daysUntilExpiry} day{daysUntilExpiry !== 1 ? 's' : ''}
                  </span>
                </>
              ) : null}
            </div>
          </>
        )}

        {/* PRO Badge - shown when license is valid */}
        {isLicenseValid && (
          <>
            <div className="h-3 w-px bg-border" />
            <div
              className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 cursor-pointer hover:bg-amber-500/20 transition-colors"
              onClick={() => setLicenseDialogOpen(true)}
              title="Pro License Active"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span className="text-xs font-semibold">Pro</span>
            </div>
          </>
        )}
      </div>

      {/* License Dialog */}
      <LicenseDialog open={licenseDialogOpen} onOpenChange={setLicenseDialogOpen} />

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
