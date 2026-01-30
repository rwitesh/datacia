import { useQuery } from "@tanstack/react-query";
import { GetAppInfo as WGetAppInfo } from "./bindings/index";


export interface AppInfo {
    os: string;
    os_version: string;
    arch: string;
    appearance: string;
    version: string;
}

export function useAppInfo() {
    return useQuery<AppInfo>({
        queryKey: ["app-info"],
        queryFn: WGetAppInfo as unknown as () => Promise<AppInfo>,
        staleTime: Infinity,
    });
}
