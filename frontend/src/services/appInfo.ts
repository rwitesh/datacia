import { useQuery } from "@tanstack/react-query";
import { GetAppInfo as WGetAppInfo } from "./bindings/index";


export function useAppInfo() {
    return useQuery({
        queryKey: ["app-info"],
        queryFn: WGetAppInfo,
        staleTime: Infinity, // Version doesn't change during runtime
    });
}
