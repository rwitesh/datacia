import { type DatabaseEngine, type FormValues } from './types';

// Default ports for different database engines
export const DEFAULT_PORTS: Record<DatabaseEngine, string> = {
  clickhouse: "9000",
  postgres: "5432",
};

// Engine display names
export const ENGINE_LABELS: Record<DatabaseEngine, string> = {
  clickhouse: "ClickHouse",
  postgres: "PostgreSQL",
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
};