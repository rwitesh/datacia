import { ConnectionConfig, SSHConfig } from "@/services/bindings";
import { DATABASE_ENGINES } from "@/shared/utils/engines";
import { DEFAULT_SSL_MODE } from "./constants";
import type { FormValues } from "./types";

// An SSH key replaces the password, so only the one in use is sent.
// acceptedFingerprint is an SSH host key the user confirmed, if any.
export const toConnectionConfig = (values: FormValues, acceptedFingerprint = ""): ConnectionConfig => {
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
          acceptedFingerprint,
        })
      : new SSHConfig(),
  });
};

interface HostAddress {
  host: string;
  port: string;
  username: string;
  password: string;
  database: string;
  // The URL was https, so the server expects TLS.
  secure: boolean;
}

// parseHostAddress splits a URL or host:port typed into the host field, such
// as "https://user@db.example.com:8443/analytics", "http:db.local" or
// "10.0.0.5:8123". A part the text doesn't name is "", so the form keeps its
// value. It returns null when the text isn't an address, such as a bare IPv6
// address, which stays as typed.
export const parseHostAddress = (input: string): HostAddress | null => {
  const text = input.trim().replace(/^jdbc:/i, "");
  // URL needs "//" after a scheme, which people leave out ("http:db.local").
  // Without it, "name:rest" is still a host and port ("localhost:8123") or a
  // user and password ("user:password@host"); a placeholder scheme parses those.
  const bare = /^([a-z][a-z\d+.-]*):\/*([^@]+)$/i.exec(text);
  const address = text.includes("://")
    ? text
    : bare && !/^\d+(\/|$)/.test(bare[2])
      ? `${bare[1]}://${bare[2]}`
      : `db://${text}`;
  try {
    const url = new URL(address);
    if (!url.hostname) return null;
    return {
      // The driver adds an IPv6 address's brackets back itself.
      host: url.hostname.replace(/^\[(.*)\]$/, "$1"),
      port: url.port,
      username: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: decodeURIComponent(url.pathname.replace(/^\/+|\/+$/g, "")),
      secure: url.protocol === "https:",
    };
  } catch {
    // Not a URL, or a malformed %-escape.
    return null;
  }
};
