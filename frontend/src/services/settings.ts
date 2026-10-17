import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { GetAppInfo, UpdateSettings, type Info, type Settings } from "./bindings/settings";
export type { Info, Settings, EditorConfig, TokenColors, AIConfig, AIProviderConfig } from "./bindings/settings";
export { ThemeConfig } from "./bindings/settings";

export function useSettings() {
    return useQuery<Info>({
        queryKey: ["settings"],
        queryFn: async () => {
            const info = await GetAppInfo();
            if (!info) throw new Error("Failed to load settings");
            return info;
        },
        staleTime: Infinity,
    });
}

/** API key changes by provider ID: a new key, or "" to remove the saved one. */
export type KeyChanges = Record<string, string>;

export function useUpdateSettings() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ settings, keys = {} }: { settings: Settings; keys?: KeyChanges }) => {
            const info = await UpdateSettings(settings, keys);
            if (!info) throw new Error("Failed to update settings");
            return info;
        },
        onSuccess: (info) => {
            queryClient.setQueryData(["settings"], info);
            queryClient.invalidateQueries({ queryKey: ["settings"] });
        },
    });
}
