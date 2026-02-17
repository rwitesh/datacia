import { DATABASE_ENGINES, type DatabaseEngine } from "@/shared/utils/engines";
import type { FormValues } from "./types";

// Re-export from centralized config for backwards compatibility
export const DEFAULT_PORTS: Record<DatabaseEngine, string> = Object.fromEntries(
  Object.entries(DATABASE_ENGINES).map(([key, config]) => [key, config.defaultPort])
) as Record<DatabaseEngine, string>;

export const ENGINE_LABELS: Record<DatabaseEngine, string> = Object.fromEntries(
  Object.entries(DATABASE_ENGINES).map(([key, config]) => [key, config.label])
) as Record<DatabaseEngine, string>;

/** Maximum saved connections allowed on the free plan (no active license). */
export const FREE_PLAN_MAX_CONNECTIONS = 2;

// Field labels for form validation messages
export const FIELD_LABELS: Record<keyof FormValues, string> = {
  connectionName: "Connection Name",
  engine: "Database Engine",
  host: "Host",
  port: "Port",
  username: "Username",
  password: "Password",
  database: "Database",
  useSSH: "Use SSH",
  sshHost: "SSH Host",
  sshPort: "SSH Port",
  sshUsername: "SSH Username",
  sshPassword: "SSH Password",
  useSSHKey: "Use SSH Key",
  sshKeyPath: "SSH Key Path",
};
