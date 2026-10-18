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
  // "" connects with the default: TLS unless the host is this machine.
  sslMode: string;
  sslCAPath: string;
}

export type StatusKind = "success" | "error" | "info";

export interface StatusMessage {
  kind: StatusKind;
  title: string;
  description?: string;
}

export type Status = StatusMessage | null;

