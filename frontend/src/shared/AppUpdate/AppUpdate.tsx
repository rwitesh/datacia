import { CheckCircle2 } from "lucide-react";
import { usePendingUpdate, useRestartApp } from "@/services/updates";

export const AppUpdate = () => {
    const { data: version } = usePendingUpdate();
    const { mutate: restartApp } = useRestartApp();

    if (!version) return null;

    return (
        <div className="flex items-center gap-1.5 text-xs">
            <CheckCircle2 className="h-3 w-3 text-green-500" />
            <span className="text-green-500">v{version} ready</span>
            <span className="text-muted-foreground">•</span>
            <span
                className="text-blue-500 cursor-pointer hover:underline"
                onClick={() => restartApp()}
            >
                Restart
            </span>
        </div>
    );
};
