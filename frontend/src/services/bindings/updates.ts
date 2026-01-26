import { CheckForUpdates as WCheckForUpdates, Update as WUpdate, RestartApp as WRestartApp } from "./index";

export async function CheckForUpdates(): Promise<boolean> {
  return WCheckForUpdates();
}

export async function PerformUpdate(): Promise<unknown> {
  return WUpdate();
}

export async function RestartApp(): Promise<void> {
  return WRestartApp();
}
