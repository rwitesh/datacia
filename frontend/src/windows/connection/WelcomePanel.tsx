import { useAppContext } from "@/context/app/Index";
import { StatusBar } from "@/shared/StatusBar/StatusBar";
import { AppUpdate } from "@/shared/AppUpdate/AppUpdate";

import logo from "@/assets/logo.png";

export const WelcomePanel = () => {
  const { settings } = useAppContext();

  return (
    <div className="h-full flex flex-col">
      <StatusBar showUpdate={false} />

      <div className="flex-1 relative flex flex-col items-center justify-center text-center p-8">
        <div className="mb-6 p-4 rounded-full bg-primary/10">
          <img src={logo} alt="Datacia" className="h-12 w-12 object-contain" />
        </div>
        <h2 className="text-xl font-semibold mb-2">Datacia</h2>
        <p className="text-muted-foreground text-sm max-w-sm">
          Select a connection from the list to edit, or create a new connection
          to get started.
        </p>

        {settings?.app_version && (
          <div className="absolute bottom-2 flex flex-col items-center gap-2 text-xs text-muted-foreground/60 h-10">
            <p>Version {settings.app_version}</p>
            <AppUpdate />
          </div>
        )}
      </div>
    </div>
  );
};
