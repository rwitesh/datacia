import { useQuery, useMutation } from "@tanstack/react-query";
import {
  ActivateLicense,
  DeactivateLicense,
  GetLicenseStatus,
  type LicenseStatus,
} from "./bindings/license";

export function useLicenseStatus() {
  return useQuery<LicenseStatus, Error>({
    queryKey: ["license-status"],
    queryFn: () => GetLicenseStatus(),
    retry: 2,
    refetchOnWindowFocus: true,
  });
}

export function useActivateLicense() {
  return useMutation({
    mutationFn: async (licenseKey: string) => {
      return ActivateLicense(licenseKey);
    },
  });
}

export function useDeactivateLicense() {
  return useMutation({
    mutationFn: async () => {
      return DeactivateLicense();
    },
  });
}
