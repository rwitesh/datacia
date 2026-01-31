import { useLicenseStatus } from "@/services/license";
import { AlertCircle, AlertTriangle, Sparkles } from "lucide-react";
import { OpenLicenseWindow } from "@/services/bindings";

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

export const AppLicense = () => {
    const { data: licenseStatus } = useLicenseStatus();

    // Determine license display state
    const hasLicenseError = licenseStatus?.error;
    const licenseExpired = isExpired(licenseStatus?.expires_at);
    const licenseExpiringSoon = isExpiringSoon(licenseStatus?.expires_at);
    const daysUntilExpiry = getDaysUntilExpiry(licenseStatus?.expires_at);

    const showLicenseWarning = hasLicenseError || licenseExpired || licenseExpiringSoon;
    const isLicenseValid = licenseStatus?.valid === true && !hasLicenseError && !licenseExpired;

    const handleOpenLicense = () => {
        OpenLicenseWindow();
    };

    return (
        <div className="flex items-center text-xs">
            {/* License Status Indicator */}
            {showLicenseWarning && (
                <div
                    className="flex items-center gap-1 cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={handleOpenLicense}
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
            )}

            {/* PRO Badge - shown when license is valid */}
            {isLicenseValid && (
                <div
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 cursor-pointer hover:bg-amber-500/20 transition-colors"
                    onClick={handleOpenLicense}
                    title="Pro License Active"
                >
                    <Sparkles className="h-3.5 w-3.5" />
                    <span className="text-xs font-semibold">Pro</span>
                </div>
            )}
        </div>
    );
};
