import React, { useState } from "react";
import { type UseFormRegister } from "react-hook-form";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ENGINE_LABELS } from "../utils/constants";
import type { DatabaseEngine, FormValues } from "../utils/types";

interface ConnectionFormProps {
  register: UseFormRegister<FormValues>;
  currentEngine: DatabaseEngine;
  loading: boolean;
}

const getHostPlaceholder = (engine: DatabaseEngine) => {
  switch (engine) {
    case "clickhouse":
      return "http://localhost";
    case "postgres":
      return "localhost";
    default:
      return "localhost";
  }
};

export const ConnectionForm: React.FC<ConnectionFormProps> = ({
  register,
  currentEngine,
  loading,
}) => {
  const [showPassword, setShowPassword] = useState(false);

  return (
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
        <Label htmlFor="engine-display" className="text-muted-foreground text-xs">
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
            onClick={() => setShowPassword((prev) => !prev)}
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
  );
};