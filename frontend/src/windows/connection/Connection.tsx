import React, { useMemo } from "react";
import { type FieldError } from "react-hook-form";
import { useFetchConnectionById } from "@/services/connections";
import { useConnectionParams } from "./hooks/useConnectionParams";
import { useConnectionForm } from "./hooks/useConnectionForm";
import { ConnectionAlert } from "./components/ConnectionAlert";
import { ConnectionForm } from "./components/ConnectionForm";
import { ConnectionActions } from "./components/ConnectionActions";
import { isValidEngine } from "@/shared/utils/engines";
import type { FormValues } from "./utils/types";

export const DatabaseConnection: React.FC = () => {
  const { connectionId, engineParam } = useConnectionParams();

  const {
    data: fetchedData,
    isLoading: isFetchingConnection,
    isFetching,
    isError,
  } = useFetchConnectionById(connectionId);

  // Determine the actual engine to use: prioritize backend, fallback to URL param
  const resolvedEngine = useMemo(() => {
    if (connectionId && fetchedData?.engine) {
      return isValidEngine(fetchedData.engine) ? fetchedData.engine : engineParam;
    }
    return engineParam;
  }, [connectionId, fetchedData?.engine, engineParam]);

  const {
    form,
    register,
    watch,
    setValue,
    status,
    setStatus,
    currentEngine,
    currentConnectionName,
    handleSave,
    handleTest,
    handleConnect,
    handleSelectSSHKey,
    handleSelectSQLiteFile,
    saveMutation,
    testMutation,
    connectMutation,
  } = useConnectionForm({
    resolvedEngine,
    connectionId,
    fetchedData,
  });

  const loading = isFetchingConnection || isFetching;
  const isUpdate = Boolean(connectionId);

  // Process form errors for display
  const formErrorEntries = Object.entries(form.formState.errors).filter(
    ([, v]) => v !== undefined
  ) as [keyof FormValues, FieldError][];
  const hasFormErrors = formErrorEntries.length > 0;

  // Get display name for alert title
  const displayName =
    currentConnectionName ||
    (connectionId && fetchedData?.connectionName) ||
    "New Connection";

  return (
    <div className="h-full flex flex-col">
      <div className="mb-3 flex-shrink-0" aria-live="polite" role="status">
        <div className="min-h-24">
          <ConnectionAlert
            hasFormErrors={hasFormErrors}
            formErrorEntries={formErrorEntries}
            isError={isError}
            fetchedConnectionName={fetchedData?.connectionName}
            status={status}
            displayName={displayName}
            currentEngine={currentEngine}
            onDismissStatus={() => setStatus(null)}
          />
        </div>
      </div>

      <div className="flex-1 px-2 overflow-y-auto min-h-0">
        <ConnectionForm
          register={register}
          watch={watch}
          setValue={setValue}
          currentEngine={currentEngine}
          loading={loading}
          onSelectSSHKey={handleSelectSSHKey}
          onSelectSQLiteFile={handleSelectSQLiteFile}
        />
      </div>

      <div className="flex-shrink-0 mt-3">
        <ConnectionActions
          isUpdate={isUpdate}
          loading={loading}
          isSubmitting={form.formState.isSubmitting}
          onSave={handleSave}
          onTest={handleTest}
          onConnect={handleConnect}
          saveMutation={saveMutation}
          testMutation={testMutation}
          connectMutation={connectMutation}
        />
      </div>
    </div>
  );
};
