import React, { useState } from "react";
import { type FieldError } from "react-hook-form";
import { Check, Copy, X } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ENGINE_LABELS, FIELD_LABELS } from "../utils/constants";
import type { FormValues, Status } from "../utils/types";
import type { DatabaseEngine } from "@/shared/utils/engines";

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

const CopyButton: React.FC<{ description: string }> = ({ description }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(description);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
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
  let variant: "default" | "destructive" | "success" = "default";
  let title: React.ReactNode = displayName;
  let icon: React.ReactNode = null;
  let action: React.ReactNode = null;
  let content: React.ReactNode = (
    <div className="text-xs">
      Enter connection details for {ENGINE_LABELS[currentEngine]}.
    </div>
  );
  let alignStart = false;

  if (hasFormErrors) {
    variant = "destructive";
    title = "Please fix the following";
    alignStart = true;
    content = (
      <ul className="ml-4 list-disc text-xs">
        {formErrorEntries.map(([field, err]) => (
          <li key={String(field)}>
            <strong>{FIELD_LABELS[field]}:</strong>{" "}
            {err?.message ?? "Invalid value"}
          </li>
        ))}
      </ul>
    );
  } else if (isError) {
    variant = "destructive";
    title = "Failed to load saved connection";
    alignStart = true;
    content = (
      <div className="text-xs">
        Unable to fetch saved connection
        {fetchedConnectionName && ` "${fetchedConnectionName}"`}.
      </div>
    );
  } else if (status) {
    variant = getAlertVariant(status);
    title = status.title;
    const isInfo = status.kind === "info";
    const isErrorStatus = status.kind === "error";

    if (isInfo) {
      icon = <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin flex-shrink-0" />;
      content = null;
    } else if (isErrorStatus) {
      icon = <X className="w-5 h-5 flex-shrink-0" />;
      if (status.description) {
        alignStart = true;
        content = (
          <div className="flex items-start gap-2">
            <div className="flex-1 text-red-400 font-mono text-xs">
              <div className="whitespace-pre-wrap break-words">{status.description}</div>
            </div>
            <CopyButton description={status.description} />
          </div>
        );
      } else {
        content = null;
      }
    } else {
      content = null;
    }

    if (!isInfo && !isErrorStatus) {
      action = (
        <button
          type="button"
          aria-label="Dismiss message"
          onClick={onDismissStatus}
          className="p-1 rounded hover:bg-muted flex-shrink-0 ml-auto"
        >
          <X className="w-4 h-4" />
        </button>
      );
    }
  }

  return (
    <Alert variant={variant} className={`h-32 flex gap-3 transition-all duration-500 ease-in-out ${alignStart ? "items-start" : "items-center"}`}>
      {icon}
      <div className="flex-1 min-h-0 flex flex-col h-full justify-center">
        <div className="flex items-center justify-between flex-shrink-0">
          <AlertTitle className="mb-0 leading-none">{title}</AlertTitle>
          {action}
        </div>
        {content && (
          <AlertDescription className={`mt-2 flex-1 min-h-0 overflow-y-auto ${status?.kind === "error" ? "animate-in fade-in slide-in-from-top-2 duration-500" : ""}`}>
            {content}
          </AlertDescription>
        )}
      </div>
    </Alert>
  );
};
