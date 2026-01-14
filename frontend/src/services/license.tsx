import {
  Activate as WActivate,
  Deactivate as WDeactivate,
  GetStatus as WGetStatus,
} from "../../bindings/datacia/internal/license/licenseservice";
import type {
  ActivateResponse,
  DeactivateResponse,
  ValidateResponse,
} from "../../bindings/datacia/internal/license/models";

export type { ActivateResponse, DeactivateResponse, ValidateResponse };

export interface LicenseStatus {
  valid: boolean;
  license_key?: string;
  expires_at?: string;
  customer_name?: string;
  customer_email?: string;
  variant_name?: string;
}

export async function ActivateLicense(
  licenseKey: string
): Promise<ActivateResponse> {
  if (!licenseKey?.trim()) {
    throw new Error("License key cannot be empty");
  }
  return WActivate(licenseKey.trim());
}

export async function DeactivateLicense(): Promise<DeactivateResponse> {
  return WDeactivate();
}

export async function GetLicenseStatus(): Promise<LicenseStatus> {
  return WGetStatus() as unknown as Promise<LicenseStatus>;
}