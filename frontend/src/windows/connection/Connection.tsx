import React from "react";
import { type FieldError } from "react-hook-form";
import { useFetchConnectionById } from "@/services/connections";
import { useConnectionParams } from "./hooks/useConnectionParams";
import { useConnectionForm } from "./hooks/useConnectionForm";
import { ConnectionAlert } from "./components/ConnectionAlert";
import { ConnectionForm } from "./components/ConnectionForm";
import { ConnectionActions } from "./components/ConnectionActions";
import { StatusBar } from "@/shared/StatusBar/StatusBar";
import { isValidEngine } from "@/shared/utils/engines";
import type { FormValues } from "./utils/types";

export const DatabaseConnection: React.FC = () => {
  const { connectionId, engineParam } = useConnectionParams();

  const { data: fetchedData, isFetching: loading, isError } = useFetchConnectionById(connectionId);

  const resolvedEngine =
    connectionId && fetchedData?.engine && isValidEngine(fetchedData.engine)
      ? fetchedData.engine
      : engineParam;

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

  const formErrorEntries = Object.entries(form.formState.errors).filter(
    ([, v]) => v !== undefined
  ) as [keyof FormValues, FieldError][];

  return (
    <div className="h-full flex flex-col">
      <StatusBar />

      <form
        className="flex-1 min-h-0 flex flex-col"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          handleConnect();
        }}
      >
        <div className="mb-3 flex-shrink-0" aria-live="polite" role="status">
          <div className="min-h-24">
            <ConnectionAlert
              formErrorEntries={formErrorEntries}
              isError={isError}
              status={status}
              displayName={currentConnectionName || "New Connection"}
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
            isUpdate={Boolean(connectionId)}
            loading={loading}
            onSave={handleSave}
            onTest={handleTest}
            isSaving={saveMutation.isPending}
            isTesting={testMutation.isPending}
            isConnecting={connectMutation.isPending}
          />
        </div>
      </form>
    </div>
  );
};
