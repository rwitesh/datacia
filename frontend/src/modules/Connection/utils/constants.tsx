import { type DatabaseEngine, type FormValues } from './types';

// Default ports for different database engines
export const DEFAULT_PORTS: Record<DatabaseEngine, string> = {
  clickhouse: "9000",
  postgres: "5432",
  mysql: "3306",
};

// Engine display names
export const ENGINE_LABELS: Record<DatabaseEngine, string> = {
  clickhouse: "ClickHouse",
  postgres: "PostgreSQL",
  mysql: "MySQL",
};

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