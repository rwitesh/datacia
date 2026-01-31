import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { GetAppInfo, UpdateSettings } from "../../bindings/datacia/internal/appinfo/service";

import * as models from "../../bindings/datacia/internal/appinfo/models";
export type { Info, Settings, EditorConfig, TokenColors } from "../../bindings/datacia/internal/appinfo/models";
export { ThemeConfig } from "../../bindings/datacia/internal/appinfo/models";

export function useAppInfo() {
    return useQuery<models.Info>({
        queryKey: ["app-info"],
        queryFn: async () => {
            const info = await GetAppInfo();
            if (!info) throw new Error("Failed to load app info");
            return info;
        },
        staleTime: Infinity,
    });
}

export function useUpdateSettings() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (settings: models.Settings) => {
            const info = await UpdateSettings(settings);
            if (!info) throw new Error("Failed to update settings");
            return info;
        },
        onSuccess: (info) => {
            queryClient.setQueryData(["app-info"], info);
            queryClient.invalidateQueries({ queryKey: ["app-info"] });
        },
    });
}
