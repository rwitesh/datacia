import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useQueryClient, useMutation } from "@tanstack/react-query";

import {
  TestNewConnection as Test,
  SaveConnection,
  UpdateConnection,
  SelectSSHKeyFile,
  SelectSQLiteFile,
} from "@/services/bindings/connection";
import { DEFAULT_PORTS } from "../utils/constants";
import { getEngineConfig, type DatabaseEngine } from "@/shared/utils/engines";
import type { FormValues, Status } from "../utils/types";
import {
  validateForSave,
  validateForTestConnect,
} from "../utils/validation";
import { useConnectDatabase } from "./useConnectDatabase";
import { errorMessage } from "@/lib/utils";
import { queryKeys } from "@/services/queryKeys";

interface FetchedConnectionData {
  name?: string;
  engine?: string;
  host?: string;
  port?: string;
  username?: string;
  password?: string;
  database?: string;
  useSSH?: string;
  sshHost?: string;
  sshPort?: string;
  sshUsername?: string;
  sshPassword?: string;
  sshKeyPath?: string;
  sslMode?: string;
  sslCAPath?: string;
}

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
  sslMode: "",
  sslCAPath: "",
});

interface UseConnectionFormProps {
  resolvedEngine: DatabaseEngine;
  connectionId: string;
  fetchedData?: FetchedConnectionData;
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
        useSSH: fetchedData.useSSH === "true" || false,
        sshHost: fetchedData.sshHost || "",
        sshPort: fetchedData.sshPort || "",
        sshUsername: fetchedData.sshUsername || "",
        sshPassword: fetchedData.sshPassword || "",
        useSSHKey: !!fetchedData.sshKeyPath,
        sshKeyPath: fetchedData.sshKeyPath || "",
        sslMode: fetchedData.sslMode || "",
        sslCAPath: fetchedData.sslCAPath || "",
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
      const values = getValues();
      const config: Record<string, string> = {
        engine: values.engine,
        host: values.host,
        port: values.port,
        username: values.username,
        password: values.password,
        database: values.database,
      };

      if (getEngineConfig(values.engine).supportsSSL) {
        config.sslMode = values.sslMode;
        if (values.sslMode === "verify-full") config.sslCAPath = values.sslCAPath;
      }

      if (values.useSSH) {
        config.useSSH = "true";
        config.sshHost = values.sshHost;
        config.sshPort = values.sshPort || "22";
        config.sshUsername = values.sshUsername;
        if (values.useSSHKey) {
          config.sshKeyPath = values.sshKeyPath;
        } else {
          config.sshPassword = values.sshPassword;
        }
      }

      if (connectionId) {
        await UpdateConnection(connectionId, values.connectionName, config);
      } else {
        await SaveConnection(values.connectionName, config);
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
      const values = getValues();
      await Test(
        values.engine,
        values.host,
        values.port,
        values.username,
        values.password,
        values.database,
        values.useSSH ? "true" : "",
        values.sshHost,
        values.sshPort,
        values.sshUsername,
        values.sshPassword,
        values.useSSHKey ? values.sshKeyPath : "",
        values.sslMode,
        values.sslMode === "verify-full" ? values.sslCAPath : ""
      );
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
