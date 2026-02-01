import React, { useState } from "react";
import { type FieldError } from "react-hook-form";
import { Check, Copy, X } from "lucide-react";
import { FIELD_LABELS } from "../utils/constants";
import type { FormValues, Status } from "../utils/types";

interface ConnectionAlertProps {
  hasFormErrors: boolean;
  formErrorEntries: [keyof FormValues, FieldError][];
  isError: boolean;
  fetchedConnectionName?: string;
  status: Status;
  displayName: string;
  onDismissStatus: () => void;
}

const CopyButton: React.FC<{ text: string }> = ({ text }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard not available
    }
  };

  return (
    <button
      type="button"
      aria-label="Copy error"
      title={copied ? "Copied!" : "Copy"}
      onClick={handleCopy}
      className="p-1 rounded hover:bg-muted/50 flex-shrink-0"
    >
      {copied ? (
        <Check className="w-3.5 h-3.5 text-green-500" />
      ) : (
        <Copy className="w-3.5 h-3.5 text-muted-foreground" />
      )}
    </button>
  );
};

export const ConnectionAlert: React.FC<ConnectionAlertProps> = ({
  hasFormErrors,
  formErrorEntries,
  isError,
  fetchedConnectionName,
  status,
  displayName,
  onDismissStatus,
}) => {
  const isErrorStatus = status?.kind === "error";
  const isInfo = status?.kind === "info";
  const isSuccess = status?.kind === "success";
  const isDefault = !hasFormErrors && !isError && !status;

  let variant: "default" | "destructive" | "success" = "default";
  let title = displayName;
  let description: string | null = null;

  if (hasFormErrors) {
    variant = "destructive";
    title = "Please fix the following";
    description = formErrorEntries
      .map(([field, err]) => `${FIELD_LABELS[field]}: ${err?.message ?? "Invalid value"}`)
      .join("\n");
  } else if (isError) {
    variant = "destructive";
    title = "Failed to load saved connection";
    description = `Unable to fetch saved connection${fetchedConnectionName ? ` "${fetchedConnectionName}"` : ""}.`;
  } else if (status) {
    title = status.title;
    description = status.description || null;
    if (isErrorStatus) variant = "destructive";
    else if (isSuccess) variant = "success";
  }

  const showDescription = description && !isInfo;
  const bgClass =
    variant === "destructive"
      ? "border-destructive/50 text-destructive"
      : variant === "success"
        ? "border-green-500/50 text-green-500"
        : "border-muted text-foreground";

  return (
    <div className={`h-32 flex flex-col rounded-lg border bg-card p-3 overflow-hidden ${bgClass}`}>
      <div className="flex items-center gap-2 flex-shrink-0">
        {isInfo && (
          <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin flex-shrink-0" />
        )}
        {isErrorStatus && <X className="w-4 h-4 flex-shrink-0" />}

        <span className="font-medium text-sm truncate flex-1">
          {isDefault ? "Enter connection details" : title}
        </span>

        {description && isErrorStatus && <CopyButton text={description} />}
        {isSuccess && (
          <button
            type="button"
            aria-label="Dismiss"
            onClick={onDismissStatus}
            className="p-1 rounded hover:bg-muted/50 flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {showDescription && (
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="p-2 rounded text-red font-mono text-xs whitespace-pre-wrap break-all">
            {description}
          </div>
        </div>
      )}
    </div>
  );
};
