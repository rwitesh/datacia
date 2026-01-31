import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Settings as SettingsIcon, Monitor, Moon, Sun } from "lucide-react";
import { Window } from "@wailsio/runtime";
import { useTheme } from "@/components/theme";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useAppInfo, useUpdateSettings } from "@/services/appInfo";
import { useEffect, useState } from "react";
import { DEFAULT_LIGHT_COLORS, DEFAULT_DARK_COLORS } from "@/windows/editor/QueryInput/utils/theme";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const TOKEN_LABELS: Record<string, string> = {
  keyword: "Keywords",
  string: "Strings",
  number: "Numbers",
  comment: "Comments",
  function: "Functions",
  variable: "Variables",
  type: "Types",
  operator: "Operators",
};

const UI_FONTS = [
  { value: "Inter", label: "Inter" },
  { value: "system-ui", label: "System Default" },
  { value: "JetBrains Mono", label: "JetBrains Mono" },
];

const EDITOR_FONTS = [
  { value: "JetBrains Mono", label: "JetBrains Mono" },
  { value: "Fira Code", label: "Fira Code" },
  { value: "monospace", label: "System Monospace" },
];

const FONT_SIZES = [
  { value: 12, label: "12px" },
  { value: 13, label: "13px" },
  { value: 14, label: "14px" },
  { value: 15, label: "15px" },
  { value: 16, label: "16px" },
  { value: 18, label: "18px" },
];


import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function FontSection() {
  const { data: appInfo } = useAppInfo();
  const { mutate: updateSettings } = useUpdateSettings();
  const [showSaved, setShowSaved] = useState(false);

  const [uiFont, setUiFont] = useState(appInfo?.settings?.font?.uiFontFamily || "system-ui");
  const [uiFontSize, setUiFontSize] = useState(appInfo?.settings?.font?.uiFontSize || 14);
  const [editorFont, setEditorFont] = useState(appInfo?.settings?.font?.editorFontFamily || "JetBrains Mono");
  const [editorFontSize, setEditorFontSize] = useState(appInfo?.settings?.font?.editorFontSize || 14);

  useEffect(() => {
    if (appInfo?.settings?.font) {
      setUiFont(appInfo.settings.font.uiFontFamily || "system-ui");
      setUiFontSize(appInfo.settings.font.uiFontSize || 12);
      setEditorFont(appInfo.settings.font.editorFontFamily || "JetBrains Mono");
      setEditorFontSize(appInfo.settings.font.editorFontSize || 14);
    }
  }, [appInfo]);

  const saveChanges = () => {
    if (!appInfo) return;
    const newSettings = {
      ...appInfo.settings,
      font: {
        uiFontFamily: uiFont,
        uiFontSize: uiFontSize,
        editorFontFamily: editorFont,
        editorFontSize: editorFontSize,
      }
    };
    updateSettings(newSettings as any, {
      onSuccess: () => {
        setShowSaved(true);
        setTimeout(() => setShowSaved(false), 2000);
      }
    });
  };

  const resetDefaults = () => {
    setUiFont("system-ui");
    setUiFontSize(12);
    setEditorFont("JetBrains Mono");
    setEditorFontSize(14);
    setShowSaved(false);
  };

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold">Fonts</h3>
        <p className="text-xs text-muted-foreground">
          Customize application and editor fonts
        </p>
      </div>

      <div className="rounded-md border p-3 space-y-4">
        {/* UI Font Section */}
        <div className="space-y-3">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Application Font
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Font Family</Label>
              <Select value={uiFont} onValueChange={setUiFont}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UI_FONTS.map(font => (
                    <SelectItem key={font.value} value={font.value} className="text-xs">
                      <span style={{ fontFamily: font.value }}>{font.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Font Size</Label>
              <Select value={String(uiFontSize)} onValueChange={v => setUiFontSize(Number(v))}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FONT_SIZES.map(size => (
                    <SelectItem key={size.value} value={String(size.value)} className="text-xs">
                      {size.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {/* UI Font Preview */}
          <div
            className="p-3 rounded border bg-muted/30 text-sm"
            style={{ fontFamily: uiFont, fontSize: `${uiFontSize}px` }}
          >
            The quick brown fox jumps over the lazy dog. 0123456789
          </div>
        </div>

        {/* Editor Font Section */}
        <div className="space-y-3 pt-3 border-t">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Editor Font
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Font Family</Label>
              <Select value={editorFont} onValueChange={setEditorFont}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EDITOR_FONTS.map(font => (
                    <SelectItem key={font.value} value={font.value} className="text-xs">
                      <span style={{ fontFamily: font.value }}>{font.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Font Size</Label>
              <Select value={String(editorFontSize)} onValueChange={v => setEditorFontSize(Number(v))}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FONT_SIZES.map(size => (
                    <SelectItem key={size.value} value={String(size.value)} className="text-xs">
                      {size.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {/* Editor Font Preview */}
          <div
            className="p-3 rounded border bg-card font-mono text-sm overflow-x-auto"
            style={{ fontFamily: editorFont, fontSize: `${editorFontSize}px` }}
          >
            <span className="text-blue-500">SELECT</span> id, name, created_at<br/>
            <span className="text-blue-500">FROM</span> users<br/>
            <span className="text-blue-500">WHERE</span> status = <span className="text-green-500">'active'</span>;
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          {showSaved && (
            <span className="text-xs text-green-500 font-medium animate-in fade-in slide-in-from-right-2">
              Settings saved
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={resetDefaults}
            className="h-7 text-xs px-2 hover:bg-transparent hover:text-destructive"
          >
            Reset
          </Button>
          <Button size="sm" onClick={saveChanges} className="h-7 text-xs px-3">
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}

function EditorSection() {
  const { data: appInfo } = useAppInfo();
  const { mutate: updateSettings } = useUpdateSettings();
  const [colorsLight, setColorsLight] = useState<Record<string, string>>({});
  const [colorsDark, setColorsDark] = useState<Record<string, string>>({});
  const [showSaved, setShowSaved] = useState(false);

  useEffect(() => {
    if (appInfo?.settings?.editor) {
      setColorsLight(appInfo.settings.editor.tokenColorsLight as any || {});
      setColorsDark(appInfo.settings.editor.tokenColorsDark as any || {});
    }
  }, [appInfo]);

  const handleColorChange = (key: string, value: string, mode: 'light' | 'dark') => {
    if (mode === 'light') {
      setColorsLight(prev => ({ ...prev, [key]: value }));
    } else {
      setColorsDark(prev => ({ ...prev, [key]: value }));
    }
    setShowSaved(false);
  };

  const saveChanges = () => {
    if (!appInfo) return;
    const newSettings = {
      ...appInfo.settings,
      editor: {
        ...appInfo.settings.editor,
        tokenColorsLight: colorsLight,
        tokenColorsDark: colorsDark,
      }
    };
    updateSettings(newSettings as any, {
      onSuccess: () => {
        setShowSaved(true);
        setTimeout(() => setShowSaved(false), 2000);
      }
    });
  };

  const resetDefaults = () => {
    setColorsLight({});
    setColorsDark({});
    if (!appInfo) return;
    const newSettings = {
      ...appInfo.settings,
      editor: {
        ...appInfo.settings.editor,
        tokenColorsLight: {},
        tokenColorsDark: {},
      }
    };
    updateSettings(newSettings as any, {
      onSuccess: () => {
        setShowSaved(true);
        setTimeout(() => setShowSaved(false), 2000);
      }
    });
  };

  const renderColorGrid = (mode: 'light' | 'dark') => {
    const currentColors = mode === 'light' ? colorsLight : colorsDark;
    const defaultColors = mode === 'light' ? DEFAULT_LIGHT_COLORS : DEFAULT_DARK_COLORS;

    return (
      <div className="grid grid-cols-2 gap-3 pt-4">
        {Object.entries(TOKEN_LABELS).map(([key, label]) => {
          const colorValue = currentColors[key];
          const defaultColor = defaultColors[key];
          const displayColor = colorValue || defaultColor;

          return (
            <div key={key} className="space-y-1">
              <Label htmlFor={`color-${mode}-${key}`} className="text-xs font-normal text-muted-foreground">{label}</Label>
              <div className="flex items-center gap-2">
                <div className="relative w-6 h-6 rounded-full border shadow-sm overflow-hidden shrink-0 group">
                  <div
                    className="absolute inset-0 w-full h-full"
                    style={{ backgroundColor: displayColor }}
                  />
                  <Input
                    type="color"
                    id={`color-${mode}-${key}`}
                    value={displayColor}
                    onChange={(e) => handleColorChange(key, e.target.value, mode)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer p-0 border-0"
                  />
                </div>
                <Input
                  type="text"
                  value={colorValue || ""}
                  placeholder={`Default: ${defaultColor}`}
                  onChange={(e) => handleColorChange(key, e.target.value, mode)}
                  className="h-7 text-xs font-mono uppercase px-2"
                />
              </div>
            </div>
          )
        })}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold">Editor</h3>
        <p className="text-xs text-muted-foreground">
          Syntax highlighting
        </p>
      </div>

      <div className="rounded-md border p-3 space-y-3">
        <Tabs defaultValue="dark" className="w-full">
          <div className="flex items-center justify-between">
            <TabsList className="h-8">
              <TabsTrigger value="light" className="text-xs h-6 px-3">Light Mode</TabsTrigger>
              <TabsTrigger value="dark" className="text-xs h-6 px-3">Dark Mode</TabsTrigger>
            </TabsList>
            <div className="flex items-center gap-3">
              {showSaved && <span className="text-xs text-green-500 font-medium animate-in fade-in slide-in-from-right-2 ml-4">Settings saved</span>}
              <Button variant="ghost" size="sm" onClick={resetDefaults} className="h-7 text-xs px-2 hover:bg-transparent hover:text-destructive">
                Reset
              </Button>
              <Button size="sm" onClick={saveChanges} className="h-7 text-xs px-3">
                Save
              </Button>
            </div>
          </div>
          <TabsContent value="light" className="mt-0">
            {renderColorGrid('light')}
          </TabsContent>
          <TabsContent value="dark" className="mt-0">
            {renderColorGrid('dark')}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function AppearanceSection() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold">Appearance</h3>
        <p className="text-xs text-muted-foreground">
          App theme
        </p>
      </div>
      <div className="flex items-center justify-between rounded-md border p-3">
        <div className="space-y-0.5">
          <div className="text-sm font-medium">Theme Mode</div>
        </div>
        <ToggleGroup
          type="single"
          value={theme}
          onValueChange={(val) => val && setTheme(val as any)}
          size="sm"
        >
          <ToggleGroupItem value="light" aria-label="Light" className="h-7 w-7 p-0 data-[state=on]:bg-muted">
            <Sun className="h-3.5 w-3.5" />
          </ToggleGroupItem>
          <ToggleGroupItem value="dark" aria-label="Dark" className="h-7 w-7 p-0 data-[state=on]:bg-muted">
            <Moon className="h-3.5 w-3.5" />
          </ToggleGroupItem>
          <ToggleGroupItem value="system" aria-label="System" className="h-7 w-7 p-0 data-[state=on]:bg-muted">
            <Monitor className="h-3.5 w-3.5" />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
    </div>
  );
}

export function Settings() {
  const handleClose = () => {
    Window.Close();
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-card text-foreground select-none overflow-hidden">
      {/* Draggable title bar */}
      <div
        className="h-10 shrink-0"
        style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
      />

      {/* Content */}
      <div className="flex-1 overflow-auto px-5 pb-5 scrollbar-none">
        <div className="flex items-center gap-2 mb-1">
          <SettingsIcon className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-base">Settings</span>
        </div>
        <p className="text-xs text-muted-foreground mb-5">
          Preferences and configuration
        </p>

        <div className="space-y-6">
          <AppearanceSection />
          <FontSection />
          <EditorSection />
        </div>
      </div>

      {/* Footer */}
      <div className="border-t p-3 shrink-0 bg-muted/20">
        <Button variant="outline" onClick={handleClose} className="w-full h-8 text-xs">
          Close
        </Button>
      </div>
    </div>
  );
}
