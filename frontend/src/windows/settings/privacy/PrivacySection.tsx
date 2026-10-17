import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { Settings as AppSettings } from "@/services/settings";

type PrivacySectionProps = {
  settings: AppSettings;
  onChange: (settings: AppSettings) => void;
};

export function PrivacySection({ settings, onChange }: PrivacySectionProps) {
  const sendErrorReports = !settings.privacy?.disableErrorReports;

  return (
    <div className="space-y-3">
      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Error reports
      </div>
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="privacy-error-reports"
          checked={sendErrorReports}
          onChange={(e) =>
            onChange({
              ...settings,
              privacy: { ...settings.privacy, disableErrorReports: !e.target.checked },
            })
          }
          className={cn(
            "h-4 w-4 rounded border-input bg-background text-primary",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            "cursor-pointer"
          )}
        />
        <Label htmlFor="privacy-error-reports" className="text-sm font-medium cursor-pointer">
          Send anonymous error reports
        </Label>
      </div>
      <p className="text-xs text-muted-foreground pl-6">
        Reports contain crashes and error messages (which can include a database name or host),
        the app version, OS and an anonymous device ID. Queries, results and passwords are never
        sent.
      </p>
    </div>
  );
}
