// All engine types and constants are in @/shared/utils/engines
// Import from there directly - no need for re-exports
import type { DatabaseEngine } from "@/shared/utils/engines";

export interface FormValues {
  connectionName: string;
  engine: DatabaseEngine;
  host: string;
  port: string;
  username: string;
  password: string;
  database: string;
  useSSH: boolean;
  sshHost: string;
  sshPort: string;
  sshUsername: string;
  sshPassword: string;
  useSSHKey: boolean;
  sshKeyPath: string;
}

export interface ConnectionConfig {
  engine: DatabaseEngine;
  host: string;
  port: string;
  username: string;
  password: string;
  database: string;
  useSSH?: string;
  sshHost?: string;
  sshPort?: string;
  sshUsername?: string;
  sshPassword?: string;
  sshKeyPath?: string;
}

export interface FetchedConnection {
  id?: string;
  name?: string;
  connectionName?: string;
  engine?: string;
  host?: string;
  port?: string;
  username?: string;
  password?: string;
  database?: string;
}

export type StatusKind = "success" | "error" | "info";

export interface StatusMessage {
  kind: StatusKind;
  title: string;
  description?: string;
}

export type Status = StatusMessage | null;

export type ValidationErrors = Partial<Record<keyof FormValues, string>>;

export interface ConnectionFormState {
  isLoading: boolean;
  isSubmitting: boolean;
  hasErrors: boolean;
  status: Status;
}
