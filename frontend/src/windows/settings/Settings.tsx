import { useEffect, useState, type CSSProperties } from "react";
import { Button } from "@/components/ui/button";
import { Settings as SettingsIcon } from "lucide-react";
import { Window } from "@wailsio/runtime";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAppInfo, useUpdateSettings, type Settings as AppSettings } from "@/services/appInfo";
import { AppearanceSection } from "./appearance";


export function Settings() {
  const { data: appInfo } = useAppInfo();
  const { mutate: updateSettings, isPending } = useUpdateSettings();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [showSaved, setShowSaved] = useState(false);

  useEffect(() => {
    if (appInfo?.settings) {
      setSettings(appInfo.settings);
    }
  }, [appInfo]);

  const handleCancel = () => {
    Window.Close();
  };

  const handleSave = () => {
    if (!settings) return;
    setShowSaved(false);
    updateSettings(settings, {
      onSuccess: () => {
        setShowSaved(true);
      },
    });
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-card text-foreground select-none overflow-hidden">
      <div
        className="h-10 shrink-0"
        style={{ WebkitAppRegion: "drag" } as CSSProperties}
      />

      <div className="flex-1 flex flex-col min-h-0">
        <Tabs defaultValue="settings" className="flex flex-1 flex-col min-h-0">
          <div className="px-5 pt-3 pb-2 border-b">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <SettingsIcon className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-base">Settings</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Preferences and configuration
                </p>
              </div>
              <TabsList className="h-8 shrink-0">
                <TabsTrigger value="settings" className="text-xs h-7 px-3">
                  Settings
                </TabsTrigger>
                {/* <TabsTrigger value="license" className="text-xs h-7 px-3">
                  License
                </TabsTrigger> */}
              </TabsList>
            </div>
          </div>

          <div className="flex-1 overflow-auto px-5 pb-5 pt-4">
            <TabsContent value="settings" className="mt-0">
              {settings ? (
                <div className="space-y-6">
                  <AppearanceSection
                    settings={settings}
                    onChange={(next) => {
                      setShowSaved(false);
                      setSettings(next);
                    }}
                  />
                </div>
              ) : (
                <div className="text-xs text-muted-foreground px-1">
                  Loading settings...
                </div>
              )}
            </TabsContent>
            {/* <TabsContent value="license" className="mt-0">
              <LicenseSection />
            </TabsContent> */}
          </div>
        </Tabs>
      </div>

      <div className="border-t p-3 shrink-0 bg-muted/20">
        <div className="flex items-center justify-end gap-3">
          {showSaved && (
            <span className="text-xs text-green-500 font-medium">
              Settings saved
            </span>
          )}
          <Button
            variant="outline"
            onClick={handleCancel}
            className="h-8 text-xs px-3 cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            className="h-8 text-xs px-3 cursor-pointer"
            disabled={!settings || isPending}
          >
            Save changes
          </Button>
        </div>
      </div>
    </div>
  );
}
