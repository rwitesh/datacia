import { ConnectionConfig, SSHConfig } from "@/services/bindings";
import type { FormValues } from "./types";

// An SSH key replaces the password, so only the one in use is sent.
// acceptedFingerprint is an SSH host key the user confirmed, if any.
export const toConnectionConfig = (values: FormValues, acceptedFingerprint = ""): ConnectionConfig =>
  new ConnectionConfig({
    name: values.connectionName,
    engine: values.engine,
    host: values.host,
    port: values.port,
    username: values.username,
    password: values.password,
    database: values.database,
    ssh: values.useSSH
      ? new SSHConfig({
          enabled: true,
          host: values.sshHost,
          port: values.sshPort || "22",
          username: values.sshUsername,
          password: values.useSSHKey ? "" : values.sshPassword,
          keyPath: values.useSSHKey ? values.sshKeyPath : "",
          acceptedFingerprint,
        })
      : new SSHConfig(),
  });
