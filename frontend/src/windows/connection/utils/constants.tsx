import { DATABASE_ENGINES, type DatabaseEngine } from "@/shared/utils/engines";
import type { FormValues } from "./types";

export const DEFAULT_PORTS: Record<DatabaseEngine, string> = Object.fromEntries(
  Object.entries(DATABASE_ENGINES).map(([key, config]) => [key, config.defaultPort])
) as Record<DatabaseEngine, string>;

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
