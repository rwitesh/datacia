import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { useQueryClient } from "@tanstack/react-query";
import {
  CreateNewConnection as Connect,
  TestNewConnection as Test,
  SaveConnection,
  UpdateConnection,
} from "@/services/common";
import { DEFAULT_PORTS } from "../utils/constants";
import type { DatabaseEngine, FormValues, Status } from "../utils/types";
import {
  validateForSave,
  validateForTestConnect,
  validationSchema,
} from "../utils/validation";
interface FetchedConnectionData {
  name?: string;
  engine?: string;
  host?: string;
  port?: string;
  username?: string;
  password?: string;
  database?: string;
  connectionName?: string;
}

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

  const form = useForm<FormValues>({
    resolver: yupResolver(validationSchema),
    mode: "onChange",
    defaultValues: {
      connectionName: "",
      engine: resolvedEngine,
      host: "",
      port: "",
      username: "",
      password: "",
      database: "",
    },
  });

  const { register, getValues, reset, setError, clearErrors, setValue, watch } = form;
  const currentEngine = watch("engine");
  const currentPort = watch("port");
  const currentConnectionName = watch("connectionName");

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
      });
    } else if (!connectionId) {
      reset({
        connectionName: "",
        engine: resolvedEngine,
        host: "",
        port: DEFAULT_PORTS[resolvedEngine],
        username: "",
        password: "",
        database: "",
      });
    }
    setStatus(null);
  }, [fetchedData, reset, connectionId, resolvedEngine]);

  // Clear status when form changes
  useEffect(() => {
    const subscription = watch(() => {
      if (status) setStatus(null);
    });
    return () => subscription.unsubscribe();
  }, [watch, status]);

  const applyValidationErrors = (
    validationErrors: Partial<Record<keyof FormValues, string>>
  ) => {
    clearErrors();
    Object.entries(validationErrors).forEach(([field, message]) => {
      setError(field as keyof FormValues, { type: "required", message });
    });
  };

  const handleSave = async () => {
    const values = getValues();
    const validationErrors = validateForSave(values);
    applyValidationErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    try {
      const config = {
        engine: values.engine,
        host: values.host,
        port: values.port,
        username: values.username,
        password: values.password,
        database: values.database,
      };

      if (connectionId) {
        await UpdateConnection(connectionId, values.connectionName, config);
      } else {
        await SaveConnection(values.connectionName, config);
      }

      queryClient.invalidateQueries({ queryKey: ["connections"] });
      setStatus({
        kind: "success",
        title: connectionId ? "Connection updated" : "Connection saved",
      });
    } catch (err: unknown) {
      setStatus({
        kind: "error",
        title: "Save failed",
        description: err instanceof Error ? err.message : String(err),
      });
    }
  };

  const handleTest = async () => {
    const values = getValues();
    const validationErrors = validateForTestConnect(values);
    applyValidationErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    try {
      await Test(
        values.engine,
        values.host,
        values.port,
        values.username,
        values.password,
        values.database
      );
      setStatus({ kind: "success", title: "Connection test successful" });
    } catch (err: unknown) {
      setStatus({
        kind: "error",
        title: "Connection test failed",
        description: err instanceof Error ? err.message : String(err),
      });
    }
  };

  const handleConnect = async () => {
    const values = getValues();
    const validationErrors = validateForTestConnect(values);
    applyValidationErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    try {
      await Connect(
        values.engine,
        values.host,
        values.port,
        values.username,
        values.password,
        values.database
      );
    } catch (err: unknown) {
      setStatus({
        kind: "error",
        title: "Connection failed",
        description: err instanceof Error ? err.message : String(err),
      });
    }
  };

  return {
    form,
    register,
    status,
    setStatus,
    currentEngine,
    currentConnectionName,
    handleSave,
    handleTest,
    handleConnect,
  };
};