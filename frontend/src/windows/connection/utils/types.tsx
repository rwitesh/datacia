import type { DatabaseEngine } from "@/shared/utils/engines";

export interface FormValues {
  connectionName: string;
  engine: DatabaseEngine;
  host: string;
  port: string;
  username: string;
  password: string;
  database: string;
  sslMode: string;
  sslCaPath: string;
  useSSH: boolean;
  sshHost: string;
  sshPort: string;
  sshUsername: string;
  sshPassword: string;
  useSSHKey: boolean;
  sshKeyPath: string;
}

export type Status = {
  kind: "success" | "error" | "info";
  title: string;
  description?: string;
} | null;

