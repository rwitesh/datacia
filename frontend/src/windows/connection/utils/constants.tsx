import { DATABASE_ENGINES, type DatabaseEngine } from "@/shared/utils/engines";
import type { FormValues } from "./types";

export const DEFAULT_PORTS: Record<DatabaseEngine, string> = Object.fromEntries(
  Object.entries(DATABASE_ENGINES).map(([key, config]) => [key, config.defaultPort])
) as Record<DatabaseEngine, string>;

export const DEFAULT_SSL_MODE = "automatic";

// The values match the SSLMode constants in pkg/common/tls.go.
export const SSL_MODES = [
  {
    value: DEFAULT_SSL_MODE,
    label: "Automatic",
    hint: "The driver's default: PostgreSQL tries TLS without checking the certificate and falls back to unencrypted; MySQL and ClickHouse are unencrypted. Use another mode on untrusted networks.",
  },
  {
    value: "disable",
    label: "Disable",
    hint: "Never encrypts the connection.",
  },
  {
    value: "require",
    label: "Require (no verification)",
    hint: "Always encrypts, but doesn't check who the server is. This only protects against eavesdropping, not against someone impersonating the server.",
  },
  {
    value: "verify-full",
    label: "Verify certificate",
    hint: "Always encrypts and checks the server's certificate and host name. Recommended for remote servers.",
  },
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
  sslMode: "SSL Mode",
  sslCaPath: "CA Certificate",
  useSSH: "Use SSH",
  sshHost: "SSH Host",
  sshPort: "SSH Port",
  sshUsername: "SSH Username",
  sshPassword: "SSH Password",
  useSSHKey: "Use SSH Key",
  sshKeyPath: "SSH Key Path",
};
