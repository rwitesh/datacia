import { useAppContext } from "@/context/app/Index";
import { Database, Settings } from "lucide-react";
import { AppLicense } from "@/shared/AppLicense/AppLicense";
import { OpenSettingsWindow } from "@/services/bindings";

export const WelcomePanel = () => {
    const { appVersion } = useAppContext();

    return (
        <div className="h-full relative flex flex-col items-center justify-center text-center p-8">
            <div className="absolute top-4 right-4 flex items-center gap-2">
                <button
                    onClick={() => OpenSettingsWindow()}
                    className="flex items-center gap-1 px-2 py-1 rounded text-xs text-muted-foreground hover:bg-muted/50 transition-colors"
                    title="Settings"
                >
                    <Settings className="h-3.5 w-3.5" />
                </button>
                <AppLicense />
            </div>

            <div className="mb-6 p-4 rounded-full bg-primary/10">
                <Database className="h-12 w-12 text-primary" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Datacia</h2>
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
