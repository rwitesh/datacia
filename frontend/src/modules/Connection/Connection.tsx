import React, { useEffect, useMemo, useState } from "react";
import { useForm, type FieldError } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff, Save, Terminal, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "react-router";
import {
  CreateNewConnection as Connect,
  TestNewConnection as Test,
  SaveConnection,
  UpdateConnection,
} from "@/services/common";
import { useFetchConnectionById } from "@/services/hooks";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { DEFAULT_PORTS, ENGINE_LABELS, FIELD_LABELS } from "./utils/constants";
import type { DatabaseEngine, FormValues, Status } from "./utils/types";
import { postgres, clickhouse } from "./utils/types";
import {
  validateForSave,
  validateForTestConnect,
  validationSchema,
} from "./utils/validation";

// Helper function to validate engine type
const isValidEngine = (engine: string): engine is DatabaseEngine => {
  return [postgres, clickhouse].includes(engine);
};

export const DatabaseConnection: React.FC = () => {
  const location = useLocation();
  const queryClient = useQueryClient();
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<Status>(null);

  const connectionIdParam = useMemo(() => {
    try {
      const p = new URLSearchParams(location.search);
      return p.get("id") ?? "";
    } catch {
      return "";
    }
  }, [location.search]);

  const engineParam = useMemo(() => {
    try {
      const p = new URLSearchParams(location.search);
      const engine = p.get("engine");
      return isValidEngine(engine || "")
        ? (engine as DatabaseEngine)
        : "clickhouse";
    } catch {
      return "clickhouse" as DatabaseEngine;
    }
  }, [location.search]);

  const {
    data: fetched,
    isLoading: isFetchingConnection,
    isFetching,
    isError,
  } = useFetchConnectionById(connectionIdParam);

  // Determine the actual engine to use: prioritize backend, fallback to URL param
  const resolvedEngine = useMemo(() => {
    if (connectionIdParam && fetched?.engine) {
      // If we're editing an existing connection, use backend engine
      return isValidEngine(fetched.engine) ? fetched.engine : engineParam;
    }
    // For new connections or when backend data is unavailable, use URL param
    return engineParam;
  }, [connectionIdParam, fetched?.engine, engineParam]);

  const {
    register,
    getValues,
    reset,
    setError,
    clearErrors,
    setValue,
    watch,
    formState: { isSubmitting, errors },
  } = useForm<FormValues>({
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

  const currentEngine = watch("engine");
  const currentPort = watch("port");
  const currentConnectionName = watch("connectionName");

  // Auto-update port when engine changes (only if port is empty or matches previous engine's default)
  useEffect(() => {
    const defaultPort = DEFAULT_PORTS[currentEngine];
    const isDefaultPort = Object.values(DEFAULT_PORTS).includes(currentPort);

    if (!currentPort || isDefaultPort) {
      setValue("port", defaultPort);
    }
  }, [currentEngine, setValue, currentPort]);

  // Reset form when fetched data or connection ID changes
  useEffect(() => {
    if (connectionIdParam && fetched) {
      // For existing connections, use backend data with resolved engine
      reset({
        connectionName: fetched.name || "",
        engine: resolvedEngine,
        host: fetched.host || "",
        port: fetched.port || DEFAULT_PORTS[resolvedEngine],
        username: fetched.username || "",
        password: fetched.password || "",
        database: fetched.database || "",
      });
    } else if (!connectionIdParam) {
      // For new connections, all fields should be blank/default
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
  }, [fetched, reset, connectionIdParam, resolvedEngine]);

  useEffect(() => {
    const subscription = watch(() => {
      if (status) setStatus(null);
    });
    return () => subscription.unsubscribe();
  }, [watch, status]);

  const loading = isFetchingConnection || isFetching;
  const isUpdate = Boolean(connectionIdParam);

  const applyValidationErrors = (
    validationErrors: Partial<Record<keyof FormValues, string>>
  ) => {
    clearErrors();
    Object.entries(validationErrors).forEach(([field, message]) => {
      setError(field as keyof FormValues, { type: "required", message });
    });
  };

  const onSave = async () => {
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

      if (isUpdate) {
        await UpdateConnection(
          connectionIdParam,
          values.connectionName,
          config
        );
      } else {
        await SaveConnection(values.connectionName, config);
      }

      queryClient.invalidateQueries({ queryKey: ["connections"] });
      setStatus({
        kind: "success",
        title: isUpdate ? "Connection updated" : "Connection saved",
      });
    } catch (err: unknown) {
      setStatus({
        kind: "error",
        title: "Save failed",
        description: err instanceof Error ? err.message : String(err),
      });
    }
  };

  const onTest = async () => {
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

  const onSubmit = async () => {
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

  const formErrorEntries = Object.entries(errors).filter(
    ([, v]) => v !== undefined
  ) as [keyof FormValues, FieldError][];

  const hasFormErrors = formErrorEntries.length > 0;

  const alertVariantForStatus = (s: Status) => {
    if (!s) return "default";
    return s.kind === "error" ? "destructive" : "success";
  };

  const getHostPlaceholder = (engine: DatabaseEngine) => {
    switch (engine) {
      case clickhouse:
        return "http://localhost";
      case postgres:
        return "localhost";
      default:
        return "localhost";
    }
  };

  // Get display name for alert title
  const displayName =
    currentConnectionName ||
    (connectionIdParam && fetched?.connectionName) ||
    "New Connection";

  return (
    <div className="h-full flex flex-col justify-between">
      <div>
        <div className="mb-3" aria-live="polite" role="status">
          <div className="min-h-24">
            {hasFormErrors ? (
              <Alert
                variant="destructive"
                className="min-h-28 h-full flex items-start gap-3"
              >
                <Terminal className="w-5 h-5 mt-1" />
                <div className="flex-1">
                  <AlertTitle>Please fix the following</AlertTitle>
                  <AlertDescription>
                    <ul className="ml-4 list-disc text-xs">
                      {formErrorEntries.map(([field, err]) => (
                        <li key={String(field)}>
                          <strong>{FIELD_LABELS[field]}:</strong>{" "}
                          {err?.message ?? "Invalid value"}
                        </li>
                      ))}
                    </ul>
                  </AlertDescription>
                </div>
              </Alert>
            ) : isError ? (
              <Alert
                variant="destructive"
                className="min-h-28 flex items-center gap-3"
              >
                <Terminal className="w-5 h-5" />
                <div className="flex-1">
                  <AlertTitle>Failed to load saved connection</AlertTitle>
                  <AlertDescription>
                    Unable to fetch saved connection
                    {fetched?.connectionName && ` "${fetched.connectionName}"`}.
                  </AlertDescription>
                </div>
              </Alert>
            ) : status ? (
              <Alert
                variant={alertVariantForStatus(status)}
                className="min-h-28 flex items-center gap-3"
              >
                <Terminal className="w-5 h-5" />
                <div className="flex-1">
                  <AlertTitle>{status.title}</AlertTitle>
                  {status.description && (
                    <AlertDescription className="text-xs">
                      {status.description}
                    </AlertDescription>
                  )}
                </div>
                <button
                  type="button"
                  aria-label="Dismiss message"
                  onClick={() => setStatus(null)}
                  className="ml-2 p-1 rounded hover:bg-muted"
                >
                  <X className="w-4 h-4" />
                </button>
              </Alert>
            ) : (
              <Alert
                variant="default"
                className="min-h-28 flex items-center gap-3"
              >
                <Terminal className="w-5 h-5" />
                <div className="flex-1">
                  <AlertTitle>{displayName}</AlertTitle>
                  <AlertDescription className="text-xs">
                    Enter connection details for {ENGINE_LABELS[currentEngine]}.
                  </AlertDescription>
                </div>
              </Alert>
            )}
          </div>
        </div>

        {/* Form */}
        <div>
          <div className="space-y-3 text-sm">
            <div className="space-y-1">
              <Label htmlFor="connectionName">Connection Name</Label>
              <Input
                id="connectionName"
                disabled={loading}
                {...register("connectionName")}
                placeholder="e.g., Production Database"
                className="h-6 px-2 text-sm"
              />
            </div>

            <div className="space-y-1">
              <Label
                htmlFor="engine-display"
                className="text-muted-foreground text-xs"
              >
                Database Engine
              </Label>
              <div className="h-6 px-2 text-sm bg-muted/30 rounded border flex items-center text-muted-foreground">
                {ENGINE_LABELS[currentEngine]}
              </div>
            </div>

            <div className="flex gap-2">
              <div className="flex-1 space-y-1">
                <Label htmlFor="host">Host</Label>
                <Input
                  id="host"
                  disabled={loading}
                  {...register("host")}
                  placeholder={getHostPlaceholder(currentEngine)}
                  className="h-6 px-2 text-sm"
                />
              </div>

              <div className="w-24 space-y-1">
                <Label htmlFor="port">Port</Label>
                <Input
                  id="port"
                  disabled={loading}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  {...register("port")}
                  className="h-6 px-2 text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                disabled={loading}
                {...register("username")}
                className="h-6 px-2 text-sm"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  disabled={loading}
                  {...register("password")}
                  className="h-6 px-2 pr-8 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="database">Database</Label>
              <Input
                id="database"
                disabled={loading}
                {...register("database")}
                className="h-6 px-2 text-sm"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Buttons */}
      <div className="flex justify-between items-center gap-2 pt-4">
        <Button
          type="button"
          variant="secondary"
          className="h-6 text-sm flex items-center gap-1"
          onClick={onSave}
          disabled={loading || isSubmitting}
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
            disabled={loading || isSubmitting}
          >
            Test
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="h-6 text-sm"
            onClick={onSubmit}
            disabled={isSubmitting || loading}
          >
            Connect
          </Button>
        </div>
      </div>
    </div>
  );
};
