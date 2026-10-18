import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useForm, useWatch } from "react-hook-form";
import { useQueryClient, useMutation } from "@tanstack/react-query";

import {
  TestConnection,
  SaveConnection,
  UpdateConnection,
  SelectSSHKeyFile,
  SelectSQLiteFile,
} from "@/services/bindings/connection";
import type { ConnectionConfig } from "@/services/bindings";
import { DEFAULT_SSL_MODE } from "../utils/constants";
import { toConnectionConfig } from "../utils/config";
import { DATABASE_ENGINES, type DatabaseEngine } from "@/shared/utils/engines";
import type { FormValues, Status } from "../utils/types";
import {
  validateForSave,
  validateForTestConnect,
} from "../utils/validation";
import { useTrustHostKey } from "@/shared/HostKey/HostKeyContext";
import { useConnectDatabase } from "./useConnectDatabase";
import { errorMessage } from "@/lib/utils";
import { queryKeys } from "@/services/queryKeys";

const emptyFormValues = (engine: DatabaseEngine): FormValues => ({
  connectionName: "",
  engine,
  host: "",
  port: DATABASE_ENGINES[engine].defaultPort,
  username: "",
  password: "",
  database: "",
  sslMode: DEFAULT_SSL_MODE,
  sslCaPath: "",
  useSSH: false,
  sshHost: "",
  sshPort: "",
  sshUsername: "",
  sshPassword: "",
  useSSHKey: false,
  sshKeyPath: "",
});

interface UseConnectionFormProps {
  resolvedEngine: DatabaseEngine;
  connectionId: string;
  fetchedData?: ConnectionConfig;
}

export const useConnectionForm = ({
  resolvedEngine,
  connectionId,
  fetchedData
}: UseConnectionFormProps) => {
  const queryClient = useQueryClient();
  const trustHostKey = useTrustHostKey();

  const [status, setStatus] = useState<Status>(null);

  // A different connection or engine starts without the old status message.
  const [statusSource, setStatusSource] = useState({ fetchedData, connectionId, resolvedEngine });
  if (
    statusSource.fetchedData !== fetchedData ||
    statusSource.connectionId !== connectionId ||
    statusSource.resolvedEngine !== resolvedEngine
  ) {
    setStatusSource({ fetchedData, connectionId, resolvedEngine });
    setStatus(null);
  }

  const form = useForm<FormValues>({
    mode: "onChange",
    defaultValues: emptyFormValues(resolvedEngine),
  });

  const { register, getValues, reset, setError, clearErrors, setValue, watch, control } = form;
  const currentEngine = useWatch({ control, name: "engine" });
  const currentConnectionName = useWatch({ control, name: "connectionName" });

  useEffect(() => {
    if (connectionId && fetchedData) {
      reset({
        connectionName: fetchedData.name || "",
        engine: resolvedEngine,
        host: fetchedData.host || "",
        port: fetchedData.port || DATABASE_ENGINES[resolvedEngine].defaultPort,
        username: fetchedData.username || "",
        password: fetchedData.password || "",
        database: fetchedData.database || "",
        sslMode: fetchedData.sslMode || DEFAULT_SSL_MODE,
        sslCaPath: fetchedData.sslCaPath,
        useSSH: fetchedData.ssh.enabled,
        sshHost: fetchedData.ssh.host,
        sshPort: fetchedData.ssh.port,
        sshUsername: fetchedData.ssh.username,
        sshPassword: fetchedData.ssh.password,
        useSSHKey: !!fetchedData.ssh.keyPath,
        sshKeyPath: fetchedData.ssh.keyPath,
      });
    } else if (!connectionId) {
      reset(emptyFormValues(resolvedEngine));
    }
  }, [fetchedData, reset, connectionId, resolvedEngine]);

  // Editing the form clears the last result.
  useEffect(() => {
    if (!status) return;
    return form.subscribe({
      formState: { values: true },
      callback: () => setStatus(null),
    });
  }, [form, status]);

  // validValues returns the form values, or null after showing why they
  // don't pass validate.
  const validValues = (validate: (values: FormValues) => Partial<Record<keyof FormValues, string>>) => {
    const values = getValues();
    const errors = Object.entries(validate(values));
    clearErrors();
    errors.forEach(([field, message]) => {
      setError(field as keyof FormValues, { type: "required", message });
    });
    return errors.length > 0 ? null : values;
  };

  const saveMutation = useMutation<void, Error, void, unknown>({
    mutationFn: async () => {
      const config = toConnectionConfig(getValues());

      if (connectionId) {
        await UpdateConnection({ ...config, id: connectionId });
      } else {
        await SaveConnection(config);
      }
    },
    onMutate: () => {
      setStatus({
        kind: "info",
        title: connectionId ? "Updating connection..." : "Saving connection...",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.connections });
      setStatus({
        kind: "success",
        title: connectionId ? "Connection updated" : "Connection saved",
      });
    },
    onError: (err: unknown) => {
      setStatus({
        kind: "error",
        title: "Save failed",
        description: errorMessage(err),
      });
    },
  });

  const testMutation = useMutation<void, Error, void, unknown>({
    mutationFn: () => {
      const values = getValues();
      return trustHostKey((accepted) => TestConnection(toConnectionConfig(values, accepted)));
    },
    onMutate: () => {
      setStatus({
        kind: "info",
        title: "Testing connection...",
      });
    },
    onSuccess: () => {
      setStatus({ kind: "success", title: "Connection test successful" });
    },
    onError: (err: unknown) => {
      setStatus({
        kind: "error",
        title: "Connection test failed",
        description: errorMessage(err),
      });
    },
  });

  const connectMutation = useConnectDatabase({ setStatus });

  const handleSave = () => {
    if (validValues(validateForSave)) saveMutation.mutate();
  };

  const handleTest = () => {
    if (validValues(validateForTestConnect)) testMutation.mutate();
  };

  const handleConnect = () => {
    const values = validValues(validateForTestConnect);
    if (values) connectMutation.mutate({ values });
  };

  const selectFile = async (select: () => Promise<string>, field: "sshKeyPath" | "database") => {
    try {
      const path = await select();
      if (path) setValue(field, path);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };
  const handleSelectSSHKey = () => selectFile(SelectSSHKeyFile, "sshKeyPath");
  const handleSelectSQLiteFile = () => selectFile(SelectSQLiteFile, "database");

  return {
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
  };
};
