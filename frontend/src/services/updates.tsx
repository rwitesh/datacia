import { CheckForUpdates as WCheckForUpdates, Update as WUpdate } from "./bindings";

export async function CheckForUpdates(): Promise<boolean> {
  return WCheckForUpdates();
}

export async function PerformUpdate(): Promise<unknown> {
  return WUpdate();
}