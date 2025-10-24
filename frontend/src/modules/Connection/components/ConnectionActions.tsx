import React from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ConnectionActionsProps {
  isUpdate: boolean;
  loading: boolean;
  isSubmitting: boolean;
  onSave: () => void;
  onTest: () => void;
  onConnect: () => void;
}

export const ConnectionActions: React.FC<ConnectionActionsProps> = ({
  isUpdate,
  loading,
  isSubmitting,
  onSave,
  onTest,
  onConnect,
}) => {
  const isDisabled = loading || isSubmitting;

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
        {isUpdate ? "Update" : "Save"}
      </Button>

      <div className="flex gap-2">
        <Button
          type="button"
          variant="secondary"
          className="h-6 text-sm"
          onClick={onTest}
          disabled={isDisabled}
        >
          Test
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="h-6 text-sm"
          onClick={onConnect}
          disabled={isDisabled}
        >
          Connect
        </Button>
      </div>
    </div>
  );
};