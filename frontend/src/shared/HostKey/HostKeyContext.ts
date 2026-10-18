import { createContext, useContext } from "react";

// Mirrors ssh.HostKeyUnknownCode in the Go backend.
const HOST_KEY_UNKNOWN = "ssh-host-key-unknown";

export type UnknownHostKey = { host: string; fingerprint: string };

// The backend reports an untrusted SSH host key as the error's cause.
export const unknownHostKey = (err: unknown): UnknownHostKey | null => {
  const cause = err instanceof Error ? err.cause : null;
  if (typeof cause !== "object" || cause === null) return null;
  const { code, host, fingerprint } = cause as Record<string, unknown>;
  if (code !== HOST_KEY_UNKNOWN || typeof host !== "string" || typeof fingerprint !== "string") {
    return null;
  }
  return { host, fingerprint };
};

// TrustHostKey runs connect; if the SSH host is unknown it asks the user to
// confirm the fingerprint and runs connect again with it.
export type TrustHostKey = (connect: (acceptedFingerprint: string) => Promise<void>) => Promise<void>;

export const HostKeyContext = createContext<TrustHostKey | undefined>(undefined);

export const useTrustHostKey = () => {
  const ctx = useContext(HostKeyContext);
  if (!ctx) throw new Error("useTrustHostKey must be used within a HostKeyProvider");
  return ctx;
};
