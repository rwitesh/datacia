import React, { useEffect, useMemo, useState } from "react";
import { useForm, type FieldError } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
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
} from "@/services/common";
import { useFetchConnectionByName } from "@/services/hooks";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type FormValues = {
  connectionName: string;
  host: string;
  port: string;
  username: string;
  password: string;
  database: string;
};

const schema = yup
  .object({
    connectionName: yup.string().default(""),
    host: yup.string().default(""),
    port: yup.string().default(""),
    username: yup.string().default(""),
    password: yup.string().default(""),
    database: yup.string().default(""),
  })
  .required();

type Status =
  | {
      kind: "success";
      title: string;
      description?: string;
    }
  | {
      kind: "error";
      title: string;
      description?: string;
    }
  | {
      kind: "info";
      title: string;
      description?: string;
    }
  | null;

export const ClickhouseConnection: React.FC = () => {
  const location = useLocation();
  const queryClient = useQueryClient();
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<Status>(null);

  const connectionNameParam = useMemo(() => {
    try {
      const p = new URLSearchParams(location.search);
      return p.get("name") ?? "";
    } catch {
      return "";
    }
  }, [location.search]);

  const {
    data: fetched,
    isLoading: isFetchingConnection,
    isFetching,
    isError,
  } = useFetchConnectionByName(connectionNameParam);

  const {
    register,
    getValues,
    reset,
    setError,
    clearErrors,
    formState: { isSubmitting, errors },
    watch,
  } = useForm<FormValues>({
    resolver: yupResolver(schema),
    mode: "onChange",
    defaultValues: {
      connectionName: "",
      host: "",
      port: "",
      username: "",
      password: "",
      database: "",
    },
  });

  useEffect(() => {
    if (connectionNameParam && fetched) {
      reset({
        connectionName: connectionNameParam || "",
        host: fetched.host || "",
        port: fetched.port || "",
        username: fetched.username || "",
        password: fetched.password || "",
        database: fetched.database || "",
      });
    } else if (!connectionNameParam) {
      reset({
        connectionName: "",
        host: "",
        port: "",
        username: "",
        password: "",
        database: "",
      });
    }
    setStatus(null);
  }, [fetched, reset, connectionNameParam]);

  useEffect(() => {
    const subscription = watch(() => {
      if (status) setStatus(null);
    });
    return () => subscription.unsubscribe();
  }, [watch, status]);

  const loading = isFetchingConnection || isFetching;
  const isUpdate = Boolean(connectionNameParam);

  const validateForSave = (values: FormValues) => {
    const errs: Partial<Record<keyof FormValues, string>> = {};
    if (!values.connectionName?.trim())
      errs.connectionName = "Connection name is required";
    if (!values.host?.trim()) errs.host = "Host is required";
    if (!values.port?.trim()) errs.port = "Port is required";
    if (!values.username?.trim()) errs.username = "Username is required";
    if (!values.database?.trim()) errs.database = "Database is required";
    return errs;
  };

  const validateForTestConnect = (values: FormValues) => {
    const errs: Partial<Record<keyof FormValues, string>> = {};
    if (!values.host?.trim()) errs.host = "Host is required";
    if (!values.port?.trim()) errs.port = "Port is required";
    if (!values.username?.trim()) errs.username = "Username is required";
    if (!values.database?.trim()) errs.database = "Database is required";
    return errs;
  };

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
      await SaveConnection(values.connectionName, {
        host: values.host,
        port: values.port,
        username: values.username,
        password: values.password,
        database: values.database,
      });
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

  const fieldLabels: Record<keyof FormValues, string> = {
    connectionName: "Connection Name",
    host: "Host",
    port: "Port",
    username: "Username",
    password: "Password",
    database: "Database",
  };

  const formErrorEntries = Object.entries(errors).filter(
    ([, v]) => v !== undefined
  ) as [keyof FormValues, FieldError][];

  const hasFormErrors = formErrorEntries.length > 0;

  const alertVariantForStatus = (s: Status) => {
    if (!s) return "default";
    return s.kind === "error" ? "destructive" : "success";
  };

  return (
    <div className="h-full flex flex-col justify-between">
      <div>
        {/* Top: fixed alert slot */}
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
                          <strong>{fieldLabels[field]}:</strong>{" "}
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
                    {connectionNameParam
                      ? ` (name: ${connectionNameParam})`
                      : ""}
                    .
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
                {/* small dismiss */}
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
                  <AlertTitle>{connectionNameParam ? connectionNameParam : "New Connection"}</AlertTitle>
                  <AlertDescription className="text-xs">
                    Enter connection details.
                  </AlertDescription>
                </div>
              </Alert>
            )}
          </div>
        </div>

        {/* Form */}
        <div>
          <form
            className="space-y-3 text-sm"
            onSubmit={(e) => e.preventDefault()}
          >
            <div className="space-y-1">
              <Label htmlFor="connectionName">Connection Name</Label>
              <Input
                id="connectionName"
                disabled={loading}
                {...register("connectionName")}
                placeholder="e.g., Local ClickHouse"
                className="h-6 px-2 text-sm"
              />
            </div>

            <div className="flex gap-2">
              <div className="flex-1 space-y-1">
                <Label htmlFor="host">Host</Label>
                <Input
                  id="host"
                  disabled={loading}
                  {...register("host")}
                  placeholder="http://localhost"
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
          </form>
        </div>
      </div>

      {/* Buttons */}
      <div className="flex justify-between items-center gap-2 pt-4">
        <Button
          type="button"
          variant="secondary"
          className="h-6 text-sm flex items-center gap-1 "
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
