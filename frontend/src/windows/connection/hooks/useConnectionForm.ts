import { useEffect, useState } from "react";
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
import { DEFAULT_PORTS } from "../utils/constants";
import { toConnectionConfig } from "../utils/config";
import type { DatabaseEngine } from "@/shared/utils/engines";
import type { FormValues, Status } from "../utils/types";
import {
  validateForSave,
  validateForTestConnect,
} from "../utils/validation";
import { useConnectDatabase } from "./useConnectDatabase";
import { errorMessage } from "@/lib/utils";
import { queryKeys } from "@/services/queryKeys";

const emptyFormValues = (engine: DatabaseEngine): FormValues => ({
  connectionName: "",
  engine,
  host: "",
  port: DEFAULT_PORTS[engine],
  username: "",
  password: "",
  database: "",
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

  const [status, setStatus] = useState<Status>(null);

  // Clear the status message whenever a different connection or engine is loaded
  // (React's "adjust state when props change" pattern instead of an effect).
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

  const { register, getValues, reset, setError, clearErrors, setValue, watch } = form;
  const control = form.control;
  const currentEngine = useWatch({ control, name: "engine" });
  const currentPort = useWatch({ control, name: "port" });
  const currentConnectionName = useWatch({ control, name: "connectionName" });

  // Auto-update port when engine changes
  useEffect(() => {
    const defaultPort = DEFAULT_PORTS[currentEngine];
    const isDefaultPort = Object.values(DEFAULT_PORTS).includes(currentPort);

    if (!currentPort || isDefaultPort) {
      setValue("port", defaultPort);
    }
  }, [currentEngine, setValue, currentPort]);

  // Reset form when data changes
  useEffect(() => {
    if (connectionId && fetchedData) {
      reset({
        connectionName: fetchedData.name || "",
        engine: resolvedEngine,
        host: fetchedData.host || "",
        port: fetchedData.port || DEFAULT_PORTS[resolvedEngine],
        username: fetchedData.username || "",
        password: fetchedData.password || "",
        database: fetchedData.database || "",
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

  // Clear status when form changes
  useEffect(() => {
    if (!status) return;
    return form.subscribe({
      formState: { values: true },
      callback: () => setStatus(null),
    });
  }, [form, status]);

  const applyValidationErrors = (
    validationErrors: Partial<Record<keyof FormValues, string>>
  ) => {
    clearErrors();
    Object.entries(validationErrors).forEach(([field, message]) => {
      setError(field as keyof FormValues, { type: "required", message });
    });
  };

  const saveMutation = useMutation<void, Error, void, unknown>({
    mutationFn: async () => {
      const config = toConnectionConfig(getValues());

      if (connectionId) {
        await UpdateConnection({ ...config, id: connectionId });
      } else {
        await SaveConnection(config);
      }

      queryClient.invalidateQueries({ queryKey: queryKeys.connections });
    },
    onMutate: () => {
      setStatus({
        kind: "info",
        title: connectionId ? "Updating connection..." : "Saving connection...",
      });
    },
    onSuccess: () => {
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
    mutationFn: async () => {
      await TestConnection(toConnectionConfig(getValues()));
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
    const values = getValues();
    const validationErrors = validateForSave(values);
    applyValidationErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    saveMutation.mutate();
  };

  const handleTest = () => {
    const values = getValues();
    const validationErrors = validateForTestConnect(values);
    applyValidationErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;
    testMutation.mutate();
  };

  const handleConnect = () => {
    const values = getValues();
    const validationErrors = validateForTestConnect(values);
    applyValidationErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;
    connectMutation.mutate({ values });
  };

  const handleSelectSSHKey = async (): Promise<string | null> => {
    try {
      const path = await SelectSSHKeyFile();
      return path;
    } catch (error) {
      console.error("Failed to select SSH key:", error);
      return null;
    }
  };

  const handleSelectSQLiteFile = async () => {
    try {
      const path = await SelectSQLiteFile();
      if (path) {
        setValue("database", path);
      }
    } catch (error) {
      console.error("Failed to select SQLite file:", error);
    }
  };

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
