import React, { useState } from "react";
import { type UseFormRegister, type UseFormWatch, type UseFormSetValue } from "react-hook-form";
import { Eye, EyeOff, X, FileKey } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DATABASE_ENGINES, SQLITE, type DatabaseEngine } from "@/shared/utils/engines";
import { SSL_MODES } from "../utils/constants";
import type { FormValues } from "../utils/types";

interface ConnectionFormProps {
  register: UseFormRegister<FormValues>;
  watch: UseFormWatch<FormValues>;
  setValue: UseFormSetValue<FormValues>;
  currentEngine: DatabaseEngine;
  loading: boolean;
  onSelectSSHKey: () => Promise<string | null>;
  onSelectSQLiteFile: () => Promise<void>;
}

export const ConnectionForm: React.FC<ConnectionFormProps> = ({
  register,
  watch,
  setValue,
  currentEngine,
  loading,
  onSelectSSHKey,
  onSelectSQLiteFile,
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const [showSSHPassword, setShowSSHPassword] = useState(false);

  const useSSH = watch("useSSH");
  const sslMode = watch("sslMode");
  const sslNote = SSL_MODES.find((mode) => mode.value === sslMode)?.note;
  const useSSHKey = watch("useSSHKey");
  const sshKeyPath = watch("sshKeyPath");

  const handleSelectSSHKey = async () => {
    try {
      const path = await onSelectSSHKey();
      if (path) {
        setValue("sshKeyPath", path);
      }
    } catch (error) {
      console.error("Failed to select SSH key:", error);
    }
  };

  const handleRemoveSSHKey = () => {
    setValue("sshKeyPath", "");
  };

  const getKeyFileName = (path: string) => {
    if (!path) return "";
    const parts = path.split(/[/\\]/);
    return parts[parts.length - 1];
  };

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
          {DATABASE_ENGINES[currentEngine].label}
        </div>
      </div>

      {currentEngine === SQLITE ? (
        <div className="space-y-1">
          <Label htmlFor="database">Database File</Label>
          <div className="flex gap-2">
            <Input
              id="database"
              disabled={loading}
              {...register("database")}
              placeholder="/path/to/database.sqlite"
              className="h-6 px-2 text-sm flex-1"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onSelectSQLiteFile}
              disabled={loading}
              className="h-6 px-2 text-xs"
            >
              Browse...
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex gap-2">
            <div className="flex-1 space-y-1">
              <Label htmlFor="host">Host</Label>
              <Input
                id="host"
                disabled={loading}
                {...register("host")}
                placeholder="localhost"
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
        </>
      )}

      {DATABASE_ENGINES[currentEngine].supportsSSL && (
        <div className="pt-2 border-t space-y-1">
          <Label htmlFor="sslMode">SSL</Label>
          <Select value={sslMode} onValueChange={(value) => setValue("sslMode", value)} disabled={loading}>
            <SelectTrigger id="sslMode" className="w-full px-2 py-1 data-[size=default]:h-6">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SSL_MODES.map((mode) => (
                <SelectItem key={mode.value} value={mode.value}>
                  {mode.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {sslNote && <p className="text-xs text-muted-foreground">{sslNote}</p>}
          {sslMode === "verify-full" && (
            <div className="space-y-1 pt-1">
              <Label htmlFor="sslCaPath">CA File</Label>
              <Input
                id="sslCaPath"
                disabled={loading}
                {...register("sslCaPath")}
                placeholder="Optional, e.g. /path/to/ca.pem"
                className="h-6 px-2 text-sm"
              />
            </div>
          )}
        </div>
      )}

      <div className="pt-2 border-t">
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="useSSH"
            disabled={loading}
            {...register("useSSH")}
            className="h-4 w-4 rounded border-gray-300"
          />
          <Label htmlFor="useSSH" className="text-sm font-medium cursor-pointer">
            Use SSH Tunnel
          </Label>
        </div>

        {useSSH && (
          <div className="mt-3 space-y-3 pl-2 border-l-2">
            <div className="flex gap-2">
              <div className="flex-1 space-y-1">
                <Label htmlFor="sshHost">Server</Label>
                <Input
                  id="sshHost"
                  disabled={loading}
                  {...register("sshHost")}
                  placeholder="ssh.example.com"
                  className="h-6 px-2 text-sm"
                />
              </div>

              <div className="w-24 space-y-1">
                <Label htmlFor="sshPort">Port</Label>
                <Input
                  id="sshPort"
                  disabled={loading}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  {...register("sshPort")}
                  placeholder="22"
                  className="h-6 px-2 text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="sshUsername">User</Label>
              <Input
                id="sshUsername"
                disabled={loading}
                {...register("sshUsername")}
                className="h-6 px-2 text-sm"
              />
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="useSSHKey"
                disabled={loading}
                {...register("useSSHKey")}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="useSSHKey" className="text-sm cursor-pointer">
                Use SSH Key instead of password
              </Label>
            </div>

            {useSSHKey ? (
              <div className="space-y-2">
                {sshKeyPath ? (
                  <div className="flex items-center gap-2 p-2 bg-muted/30 rounded border">
                    <FileKey className="w-4 h-4 text-muted-foreground" />
                    <span className="flex-1 text-sm truncate">{getKeyFileName(sshKeyPath)}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleRemoveSSHKey}
                      disabled={loading}
                      className="h-6 px-2"
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleSelectSSHKey}
                    disabled={loading}
                    className="h-7 w-full text-xs"
                  >
                    <FileKey className="w-3 h-3 mr-2" />
                    Choose PEM Key File
                  </Button>
                )}
                {sshKeyPath && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleSelectSSHKey}
                    disabled={loading}
                    className="h-6 w-full text-xs"
                  >
                    Change Key File
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-1">
                <Label htmlFor="sshPassword">Password</Label>
                <div className="relative">
                  <Input
                    id="sshPassword"
                    type={showSSHPassword ? "text" : "password"}
                    disabled={loading}
                    {...register("sshPassword")}
                    className="h-6 px-2 pr-8 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSSHPassword((prev) => !prev)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                    aria-label={showSSHPassword ? "Hide SSH password" : "Show SSH password"}
                  >
                    {showSSHPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};