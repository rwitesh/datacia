import {
  Activate as WActivate,
  Deactivate as WDeactivate,
  GetStatus as WGetStatus,
} from "../../../bindings/datacia/internal/license/licenseservice";
import type { Response } from "../../../bindings/datacia/internal/license/models";

export type LicenseResponse = Response;

export interface LicenseStatus {
  valid: boolean;
  license_key?: string;
  email?: string;
  expires_at?: string;
  variant_name?: string;
  error?: string;
}

export async function ActivateLicense(
  licenseKey: string
): Promise<LicenseResponse> {
  if (!licenseKey?.trim()) {
    throw new Error("License key cannot be empty");
  }
  return WActivate(licenseKey.trim());
}

export async function DeactivateLicense(): Promise<LicenseResponse> {
  return WDeactivate();
}

export async function GetLicenseStatus(): Promise<LicenseStatus> {
  return WGetStatus() as unknown as Promise<LicenseStatus>;
}
