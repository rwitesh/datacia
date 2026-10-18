import React from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ConnectionActionsProps {
  isUpdate: boolean;
  loading: boolean;
  onSave: () => void;
  onTest: () => void;
  isSaving: boolean;
  isTesting: boolean;
  isConnecting: boolean;
}

export const ConnectionActions: React.FC<ConnectionActionsProps> = ({
  isUpdate,
  loading,
  onSave,
  onTest,
  isSaving,
  isTesting,
  isConnecting,
}) => {
  const isDisabled = loading || isSaving || isTesting || isConnecting;

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
          type="submit"
          variant="secondary"
          className="h-6 text-sm"
          disabled={isDisabled}
        >
          {isConnecting ? "Connecting..." : "Connect"}
        </Button>
      </div>
    </div>
  );
};
