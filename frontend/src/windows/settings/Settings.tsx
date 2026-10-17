import { useState, type CSSProperties } from "react";
import { useSearchParams } from "react-router";
import { Button } from "@/components/ui/button";
import { Loader2, Settings as SettingsIcon } from "lucide-react";
import { Window } from "@wailsio/runtime";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { deepEqual, errorMessage } from "@/lib/utils";
import { useSettings, useUpdateSettings, type KeyChanges, type Settings as AppSettings } from "@/services/settings";
import { AppearanceSection } from "./appearance";
import { AISection } from "./ai";
import { PrivacySection } from "./privacy";

export function Settings() {
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") === "ai" ? "ai" : "settings");

  const { data: settings } = useSettings();
  const { mutate: updateSettings, isPending, error, reset } = useUpdateSettings();
  // Unsaved edits; until the user changes something the form shows the stored settings.
  const [draft, setDraft] = useState<AppSettings | null>(null);
  const [keys, setKeys] = useState<KeyChanges>({});
  const [showSaved, setShowSaved] = useState(false);
  const formSettings = draft ?? settings?.settings ?? null;
  const dirty = (draft !== null && !deepEqual(draft, settings?.settings)) || Object.keys(keys).length > 0;

  const edited = () => {
    setShowSaved(false);
    reset();
  };
  const onChange = (next: AppSettings) => {
    edited();
    setDraft(next);
  };
  const onKeysChange = (next: KeyChanges) => {
    edited();
    setKeys(next);
  };
  const loading = <div className="text-xs text-muted-foreground px-1">Loading settings...</div>;

  const handleSave = () => {
    if (!formSettings || !dirty) return;
    updateSettings(
      { settings: formSettings, keys },
      {
        onSuccess: () => {
          setDraft(null);
          setKeys({});
          setShowSaved(true);
        },
      },
    );
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-card text-foreground select-none overflow-hidden">
      <div
        className="h-10 shrink-0"
        style={{ WebkitAppRegion: "drag" } as CSSProperties}
      />

      <div className="flex-1 flex flex-col min-h-0">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-1 flex-col min-h-0">
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
                  Appearance
                </TabsTrigger>
                <TabsTrigger value="ai" className="text-xs h-7 px-3">
                  AI
                </TabsTrigger>
                <TabsTrigger value="privacy" className="text-xs h-7 px-3">
                  Privacy
                </TabsTrigger>
              </TabsList>
            </div>
          </div>

          <div className="flex-1 scroll-stable px-5 pb-5 pt-4">
            <TabsContent value="settings" className="mt-0">
              {formSettings ? <AppearanceSection settings={formSettings} onChange={onChange} /> : loading}
            </TabsContent>
            <TabsContent value="ai" className="mt-0">
              {formSettings ? <AISection settings={formSettings} onChange={onChange} keys={keys} onKeysChange={onKeysChange} /> : loading}
            </TabsContent>
            <TabsContent value="privacy" className="mt-0">
              {formSettings ? <PrivacySection settings={formSettings} onChange={onChange} /> : loading}
            </TabsContent>
          </div>
        </Tabs>
      </div>

      <div className="border-t p-3 shrink-0 bg-muted/20">
        <div className="flex items-center justify-end gap-3">
          {error ? (
            <span className="mr-auto text-xs text-destructive">{errorMessage(error)}</span>
          ) : (
            showSaved && !dirty && <span className="text-xs text-green-500 font-medium">Settings saved</span>
          )}
          <Button variant="outline" onClick={() => Window.Close()} className="h-8 text-xs px-3 cursor-pointer">
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!dirty || isPending} className="h-8 text-xs px-3 cursor-pointer">
            {isPending && <Loader2 className="animate-spin" />}
            Save changes
          </Button>
        </div>
      </div>
    </div>
  );
}
