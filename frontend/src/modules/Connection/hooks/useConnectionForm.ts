import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { useAppContext } from "@/modules/Context/App/Index";
import {
  CreateNewConnection as Connect,
  TestNewConnection as Test,
  SaveConnection,
  UpdateConnection,
  SelectSSHKeyFile,
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
  useSSH?: string;
  sshHost?: string;
  sshPort?: string;
  sshUsername?: string;
  sshPassword?: string;
  sshKeyPath?: string;
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
  const navigate = useNavigate();
  const { setEngine } = useAppContext();

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
      useSSH: false,
      sshHost: "",
      sshPort: "",
      sshUsername: "",
      sshPassword: "",
      useSSHKey: false,
      sshKeyPath: "",
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
        useSSH: fetchedData.useSSH === "true" || false,
        sshHost: fetchedData.sshHost || "",
        sshPort: fetchedData.sshPort || "",
        sshUsername: fetchedData.sshUsername || "",
        sshPassword: fetchedData.sshPassword || "",
        useSSHKey: !!fetchedData.sshKeyPath,
        sshKeyPath: fetchedData.sshKeyPath || "",
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
        useSSH: false,
        sshHost: "",
        sshPort: "",
        sshUsername: "",
        sshPassword: "",
        useSSHKey: false,
        sshKeyPath: "",
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

      queryClient.invalidateQueries({ queryKey: ["connections"] });
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
        description: err instanceof Error ? err.message : String(err),
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
        values.useSSHKey ? values.sshKeyPath : ""
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
        description: err instanceof Error ? err.message : String(err),
      });
    },
  });

  const connectMutation = useMutation<void, Error, void, unknown>({
    mutationFn: async () => {
      const values = getValues();
      await Connect(
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
        values.useSSHKey ? values.sshKeyPath : ""
      );

      // Invalidate database-related queries after successful connection
      queryClient.invalidateQueries({ queryKey: ["databases"] });
      queryClient.invalidateQueries({ queryKey: ["tables"] });
    },
    onMutate: () => {
      setStatus({
        kind: "info",
        title: "Connecting...",
      });
    },
    onSuccess: () => {
      // Store connected engine in app context
        const engine = getValues().engine;
        setEngine(engine);
        navigate("/editor");
    },
    onError: (err: unknown) => {
      setStatus({
        kind: "error",
        title: "Connection failed",
        description: err instanceof Error ? err.message : String(err),
      });
    },
  });

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
    connectMutation.mutate();
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
    saveMutation,
    testMutation,
    connectMutation,
  };
};
