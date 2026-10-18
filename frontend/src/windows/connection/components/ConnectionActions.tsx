import React from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { UseMutationResult } from "@tanstack/react-query";
import type { ConnectArgs } from "../hooks/useConnectDatabase";

interface ConnectionActionsProps {
  isUpdate: boolean;
  loading: boolean;
  onSave: () => void;
  onTest: () => void;
  onConnect: () => void;
  saveMutation: UseMutationResult<void, Error, void, unknown>;
  testMutation: UseMutationResult<void, Error, void, unknown>;
  connectMutation: UseMutationResult<void, Error, ConnectArgs, unknown>;
}

export const ConnectionActions: React.FC<ConnectionActionsProps> = ({
  isUpdate,
  loading,
  onSave,
  onTest,
  onConnect,
  saveMutation,
  testMutation,
  connectMutation,
}) => {
  const isSaving = saveMutation.isPending;
  const isTesting = testMutation.isPending;
  const isConnecting = connectMutation.isPending;
  const isAnyMutationPending = isSaving || isTesting || isConnecting;
  const isDisabled = loading || isAnyMutationPending;

  return (
    <div className="flex justify-between items-center gap-2 pt-4">
      <Button
        type="button"
        variant="secondary"
        className="h-6 text-sm flex items-center gap-1"
        onClick={onSave}
        disabled={isDisabled}
      >
        <Save className="w-4 h-4" />
        {isSaving ? (isUpdate ? "Updating..." : "Saving...") : isUpdate ? "Update" : "Save"}
      </Button>

      <div className="flex gap-2">
        <Button
          type="button"
          variant="secondary"
          className="h-6 text-sm"
          onClick={onTest}
          disabled={isDisabled}
        >
          {isTesting ? "Testing..." : "Test"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="h-6 text-sm"
          onClick={onConnect}
          disabled={isDisabled}
        >
          {isConnecting ? "Connecting..." : "Connect"}
        </Button>
      </div>
    </div>
  );
};
