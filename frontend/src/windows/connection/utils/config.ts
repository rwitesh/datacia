import { ConnectionConfig, SSHConfig } from "@/services/bindings";
import { DATABASE_ENGINES } from "@/shared/utils/engines";
import { DEFAULT_SSL_MODE } from "./constants";
import type { FormValues } from "./types";

// An SSH key replaces the password, so only the one in use is sent.
export const toConnectionConfig = (values: FormValues): ConnectionConfig => {
  const supportsSSL = DATABASE_ENGINES[values.engine].supportsSSL;
  return new ConnectionConfig({
    name: values.connectionName,
    engine: values.engine,
    host: values.host,
    port: values.port,
    username: values.username,
    password: values.password,
    database: values.database,
    // Only the options of the selected mode apply, and SQLite has none.
    sslMode: supportsSSL ? values.sslMode : DEFAULT_SSL_MODE,
    sslCaPath: supportsSSL && values.sslMode === "verify-full" ? values.sslCaPath : "",
    ssh: values.useSSH
      ? new SSHConfig({
          enabled: true,
          host: values.sshHost,
          port: values.sshPort || "22",
          username: values.sshUsername,
          password: values.useSSHKey ? "" : values.sshPassword,
          keyPath: values.useSSHKey ? values.sshKeyPath : "",
        })
      : new SSHConfig(),
  });
};
