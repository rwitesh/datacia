import { SQLITE } from "@/shared/utils/engines";
import type { FormValues } from "./types";

const isValidPort = (port: string) => /^\d+$/.test(port) && Number(port) >= 1 && Number(port) <= 65535;

export const validateForTestConnect = (values: FormValues) => {
  const errs: Partial<Record<keyof FormValues, string>> = {};
  if (!values.engine) errs.engine = "Database engine is required";

  if (values.engine === SQLITE) {
    if (!values.database?.trim()) errs.database = "Database file is required";
  } else {
    if (!values.host?.trim()) errs.host = "Host is required";
    if (!values.port?.trim()) errs.port = "Port is required";
    else if (!isValidPort(values.port)) errs.port = "Port must be 1-65535";
    if (!values.username?.trim()) errs.username = "Username is required";
    if (!values.database?.trim()) errs.database = "Database is required";
  }

  // Validate SSH fields if SSH is enabled
  if (values.useSSH) {
    if (!values.sshHost?.trim()) errs.sshHost = "SSH host is required";
    if (values.sshPort?.trim() && !isValidPort(values.sshPort)) errs.sshPort = "SSH port must be 1-65535";
    if (!values.sshUsername?.trim()) errs.sshUsername = "SSH username is required";
    if (values.useSSHKey) {
      if (!values.sshKeyPath?.trim()) errs.sshKeyPath = "SSH key file is required";
    } else {
      if (!values.sshPassword?.trim()) errs.sshPassword = "SSH password is required";
    }
  }

  return errs;
};

export const validateForSave = (values: FormValues) => {
  const errs = validateForTestConnect(values);
  if (!values.connectionName?.trim())
    errs.connectionName = "Connection name is required";
  return errs;
};
