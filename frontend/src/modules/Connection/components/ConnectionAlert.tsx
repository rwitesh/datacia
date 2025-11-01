import React from "react";
import { type FieldError } from "react-hook-form";
import { Terminal, X } from "lucide-react";
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
  return status.kind === "error" ? "destructive" : "success";
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
        <Terminal className="w-5 h-5 mt-1 flex-shrink-0" />
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
        <Terminal className="w-5 h-5 mt-1 flex-shrink-0" />
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
    return (
      <Alert variant={getAlertVariant(status)} className="min-h-28 flex items-center gap-3">
        <Terminal className="w-5 h-5 mt-1 flex-shrink-0" />
        <div className="flex-1 min-h-0">
          <div className="flex items-center">
            <AlertTitle className="mb-0">{status.title}</AlertTitle>
            <button
              type="button"
              aria-label="Dismiss message"
              onClick={onDismissStatus}
              className="p-1 rounded hover:bg-muted flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </Alert>
    );
  }

  return (
    <Alert variant="default" className="min-h-28 flex items-center gap-3">
      <Terminal className="w-5 h-5 flex-shrink-0" />
      <div className="flex-1">
        <AlertTitle>{displayName}</AlertTitle>
        <AlertDescription className="text-xs">
          Enter connection details for {ENGINE_LABELS[currentEngine]}.
        </AlertDescription>
      </div>
    </Alert>
  );
};