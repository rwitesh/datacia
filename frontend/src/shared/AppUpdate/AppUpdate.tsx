import { useState, useEffect } from "react";
import { CheckCircle2 } from "lucide-react";
import { Events } from "@wailsio/runtime";
import { useRestartApp } from "@/services/updates";

export const AppUpdate = () => {
    const [updateReady, setUpdateReady] = useState(false);
    const { mutate: restartApp } = useRestartApp();

    useEffect(() => {
        const unsubscribe = Events.On("update:ready", () => {
            setUpdateReady(true);
        });
        return () => unsubscribe();
    }, []);

    if (!updateReady) return null;

    return (
        <div className="flex items-center gap-1.5 text-xs">
            <CheckCircle2 className="h-3 w-3 text-green-500" />
            <span className="text-green-500">Updated successfully</span>
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
