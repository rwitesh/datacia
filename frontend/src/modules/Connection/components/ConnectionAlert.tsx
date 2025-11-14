import React, { useState } from "react";
import { type FieldError } from "react-hook-form";
import { Check, Copy, X } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ENGINE_LABELS, FIELD_LABELS } from "../utils/constants";
import type { DatabaseEngine, FormValues, Status } from "../utils/types";

interface ConnectionAlertProps {
  hasFormErrors: boolean;
  formErrorEntries: [keyof FormValues, FieldError][];
  isError: boolean;
  fetchedConnectionName?: string;
  status: Status;
  displayName: string;
  currentEngine: DatabaseEngine;
  onDismissStatus: () => void;
}

const getAlertVariant = (status: Status) => {
  if (!status) return "default";
  if (status.kind === "error") return "destructive";
  if (status.kind === "info") return "default";
  return "success";
};

export const ConnectionAlert: React.FC<ConnectionAlertProps> = ({
  hasFormErrors,
  formErrorEntries,
  isError,
  fetchedConnectionName,
  status,
  displayName,
  currentEngine,
  onDismissStatus,
}) => {
  if (hasFormErrors) {
    return (
      <Alert variant="destructive" className="min-h-28 flex items-start gap-3">
        <div className="flex-1 min-h-0">
          <AlertTitle>Please fix the following</AlertTitle>
          <AlertDescription className="overflow-y-auto max-h-16">
            <ul className="ml-4 list-disc text-xs">
              {formErrorEntries.map(([field, err]) => (
                <li key={String(field)}>
                  <strong>{FIELD_LABELS[field]}:</strong>{" "}
                  {err?.message ?? "Invalid value"}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </div>
      </Alert>
    );
  }

  if (isError) {
    return (
      <Alert variant="destructive" className="min-h-28 flex items-start gap-3">
        <div className="flex-1 min-h-0">
          <AlertTitle>Failed to load saved connection</AlertTitle>
          <AlertDescription className="overflow-y-auto max-h-16">
            Unable to fetch saved connection
            {fetchedConnectionName && ` "${fetchedConnectionName}"`}.
          </AlertDescription>
        </div>
      </Alert>
    );
  }

  if (status) {
    const isInfo = status.kind === "info";
    const isError = status.kind === "error";
    const hasDescription = isError && status.description;
    
    const CopyButton: React.FC<{ description: string }> = ({ description }) => {
      const [copied, setCopied] = useState(false);

      const handleCopy = async () => {
        try {
          await navigator.clipboard.writeText(description);
          setCopied(true);
        } catch {
          // Silently fail
        }
      };

      const handleKeyDown: React.KeyboardEventHandler<HTMLButtonElement> = (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleCopy();
        }
      };

      return (
        <button
          type="button"
          aria-label="Copy error message"
          title={copied ? "Copied!" : "Copy to clipboard"}
          onClick={handleCopy}
          onPointerLeave={() => setCopied(false)}
          onBlur={() => setCopied(false)}
          onKeyDown={handleKeyDown}
          className="p-1.5 rounded hover:bg-muted/50 flex-shrink-0 transition-colors"
        >
          {copied ? (
            <Check className="w-3.5 h-3.5 text-green-500" />
          ) : (
            <Copy className="w-3.5 h-3.5 text-muted-foreground" />
          )}
          <span aria-live="polite" className="sr-only">
            {copied ? "Copied to clipboard" : "Copy error message"}
          </span>
        </button>
      );
    };

    return (
      <Alert variant={getAlertVariant(status)} className={`min-h-28 flex gap-3 transition-all duration-500 ease-in-out ${hasDescription ? "items-start" : "items-center"}`}>
        {isInfo && (
          <span className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin flex-shrink-0" />
        )}
        {isError && (
          <X className="w-5 h-5 flex-shrink-0" />
        )}
        <div className="flex-1 min-h-0">
          <div className="flex items-center">
            <AlertTitle className="mb-0">
              {status.title}
            </AlertTitle>
            {!isInfo && !isError && (
              <button
                type="button"
                aria-label="Dismiss message"
                onClick={onDismissStatus}
                className="p-1 rounded hover:bg-muted flex-shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          {status.kind === "error" && status.description && (
            <AlertDescription className="mt-2 animate-in fade-in slide-in-from-top-2 duration-500">
              <div className="flex items-start gap-2">
                <div className="flex-1 text-red-400 font-mono text-xs overflow-x-auto">
                  <div className="whitespace-pre-wrap break-words">{status.description}</div>
                </div>
                <CopyButton description={status.description} />
              </div>
            </AlertDescription>
          )}
        </div>
      </Alert>
    );
  }

  return (
    <Alert variant="default" className="min-h-28 flex items-center gap-3">
      <div className="flex-1">
        <AlertTitle>{displayName}</AlertTitle>
        <AlertDescription className="text-xs">
          Enter connection details for {ENGINE_LABELS[currentEngine]}.
        </AlertDescription>
      </div>
    </Alert>
  );
};
