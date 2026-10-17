import {
  RestartApp as WRestartApp,
  PendingUpdateVersion as WPendingUpdateVersion,
} from "./index";

export async function RestartApp(): Promise<void> {
  return WRestartApp();
}

export async function PendingUpdateVersion(): Promise<string> {
  return WPendingUpdateVersion();
}
