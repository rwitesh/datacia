import { useAppContext } from "@/modules/Context/App/Index";
import { Database } from "lucide-react";

export const WelcomePanel = () => {
    const { appVersion } = useAppContext();

    return (
        <div className="h-full flex flex-col items-center justify-center text-center p-8">
            <div className="mb-6 p-4 rounded-full bg-primary/10">
                <Database className="h-12 w-12 text-primary" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Welcome to Datacia</h2>
            <p className="text-muted-foreground text-sm max-w-sm">
                Select a connection from the list to edit, or create a new connection to get started.
            </p>

            {appVersion && (
                <p className="mt-8 text-xs text-muted-foreground/60">
                    Version {appVersion}
                </p>
            )}
        </div>
    );
};
