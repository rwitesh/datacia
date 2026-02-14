import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { GetAppInfo, UpdateSettings } from "../../bindings/datacia/internal/settings/service";
import * as models from "../../bindings/datacia/internal/settings/models";
export type { Info, Settings, EditorConfig, TokenColors, AIConfig, AIProviderConfig } from "../../bindings/datacia/internal/settings/models";
export { ThemeConfig } from "../../bindings/datacia/internal/settings/models";

export function useSettings() {
    return useQuery<models.Info>({
        queryKey: ["settings"],
        queryFn: async () => {
            const info = await GetAppInfo();
            if (!info) throw new Error("Failed to load settings");
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
            queryClient.setQueryData(["settings"], info);
            queryClient.invalidateQueries({ queryKey: ["settings"] });
        },
    });
}
