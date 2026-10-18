import { DATABASE_ENGINES, type DatabaseEngine } from "@/shared/utils/engines";
import type { FormValues } from "./types";

export const DEFAULT_PORTS: Record<DatabaseEngine, string> = Object.fromEntries(
  Object.entries(DATABASE_ENGINES).map(([key, config]) => [key, config.defaultPort])
) as Record<DatabaseEngine, string>;

export const DEFAULT_SSL_MODE = "automatic";

// The values match the SSLMode constants in pkg/common/tls.go. A note shows
// only for modes that can leave the connection open to eavesdropping or spoofing.
export const SSL_MODES = [
  { value: DEFAULT_SSL_MODE, label: "Auto", note: "Driver default; may be unencrypted." },
  { value: "disable", label: "Disable", note: "Traffic is not encrypted." },
  { value: "require", label: "Require", note: "Encrypted, but the server is not verified." },
  { value: "verify-full", label: "Verify" },
];

// Field labels for form validation messages
export const FIELD_LABELS: Record<keyof FormValues, string> = {
  connectionName: "Connection Name",
  engine: "Database Engine",
  host: "Host",
  port: "Port",
  username: "Username",
  password: "Password",
  database: "Database",
  sslMode: "SSL",
  sslCaPath: "CA File",
  useSSH: "Use SSH",
  sshHost: "SSH Host",
  sshPort: "SSH Port",
  sshUsername: "SSH Username",
  sshPassword: "SSH Password",
  useSSHKey: "Use SSH Key",
  sshKeyPath: "SSH Key Path",
};
