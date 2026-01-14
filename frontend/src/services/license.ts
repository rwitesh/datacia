import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (licenseKey: string) => {
      return ActivateLicense(licenseKey);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["license-status"] });
    },
  });
}

export function useDeactivateLicense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      return DeactivateLicense();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["license-status"] });
    },
  });
}
