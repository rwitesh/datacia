import { Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { useSettings, type ThemeConfig } from "@/services/settings";
import type { Settings as AppSettings, EditorConfig, TokenColors } from "@/services/settings";

type AppearanceSectionProps = {
  settings: AppSettings;
  onChange: (settings: AppSettings) => void;
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

export function AppearanceSection({ settings, onChange }: AppearanceSectionProps) {
  const { data: settingsData } = useSettings();

  const font = settings.font;
  const editor = settings.editor;
  const defaultTokenColorsLight = settingsData?.defaultTokenColorsLight;
  const defaultTokenColorsDark = settingsData?.defaultTokenColorsDark;

  const uiFont = font?.uiFontFamily ?? "JetBrains Mono";
  const uiFontSize = font?.uiFontSize ?? 14;
  const editorFont = font?.editorFontFamily ?? "JetBrains Mono";
  const editorFontSize = font?.editorFontSize ?? 14;

  const emitFontChange = (nextFont: AppSettings["font"]) => {
    onChange({
      ...settings,
      font: nextFont,
    });
  };

  const resetFontDefaults = () => {
    const nextFont = {
      uiFontFamily: "JetBrains Mono",
      uiFontSize: 14,
      editorFontFamily: "JetBrains Mono",
      editorFontSize: 14,
    };
    emitFontChange(nextFont);
  };

  const handleEditorChange = (nextEditor: EditorConfig) => {
    onChange({
      ...settings,
      editor: nextEditor,
    });
  };

  const renderColorGrid = (mode: "light" | "dark") => {
    const currentColors = mode === "light" ? editor.light : editor.dark;
    return (
      <div className="grid grid-cols-2 gap-3 pt-4">
        {Object.entries(TOKEN_LABELS).map(([key, label]) => {
          const k = key as keyof TokenColors;
          const displayColor = currentColors?.[k] ?? "";

          const handleColorChange = (value: string) => {
            const nextEditor: EditorConfig = {
              ...editor,
              light: { ...(editor.light ?? ({} as TokenColors)) },
              dark: { ...(editor.dark ?? ({} as TokenColors)) },
            };

            if (mode === "light") {
              nextEditor.light[k] = value;
            } else {
              nextEditor.dark[k] = value;
            }

            handleEditorChange(nextEditor);
          };

          return (
            <div key={key} className="space-y-1">
              <Label htmlFor={`color-${mode}-${key}`} className="text-xs font-normal text-muted-foreground">
                {label}
              </Label>
              <div className="flex items-center gap-2">
                <div className="relative w-6 h-6 rounded-full border shadow-sm overflow-hidden shrink-0 group">
                  <div
                    className="absolute inset-0 w-full h-full"
                    style={{ backgroundColor: displayColor || "transparent" }}
                  />
                  <Input
                    type="color"
                    id={`color-${mode}-${key}`}
                    value={displayColor || "#000000"}
                    onChange={(e) => handleColorChange(e.target.value)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer p-0 border-0"
                  />
                </div>
                <Input
                  type="text"
                  value={displayColor}
                  onChange={(e) => handleColorChange(e.target.value)}
                  className="h-7 text-xs font-mono uppercase px-2"
                />
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Theme */}
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
            value={settings.theme}
            onValueChange={(val) => val && onChange({ ...settings, theme: val as ThemeConfig })}
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

      {/* Fonts */}
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
                <Select
                  value={uiFont}
                  onValueChange={(value) => {
                    emitFontChange({
                      uiFontFamily: value,
                      uiFontSize,
                      editorFontFamily: editorFont,
                      editorFontSize,
                    });
                  }}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UI_FONTS.map(fontOption => (
                      <SelectItem key={fontOption.value} value={fontOption.value} className="text-xs">
                        <span style={{ fontFamily: fontOption.value }}>{fontOption.label}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Font Size</Label>
                <Select
                  value={String(uiFontSize)}
                  onValueChange={(v) => {
                    const size = Number(v);
                    emitFontChange({
                      uiFontFamily: uiFont,
                      uiFontSize: size,
                      editorFontFamily: editorFont,
                      editorFontSize,
                    });
                  }}
                >
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
                <Select
                  value={editorFont}
                  onValueChange={(value) => {
                    emitFontChange({
                      uiFontFamily: uiFont,
                      uiFontSize,
                      editorFontFamily: value,
                      editorFontSize,
                    });
                  }}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EDITOR_FONTS.map(fontOption => (
                      <SelectItem key={fontOption.value} value={fontOption.value} className="text-xs">
                        <span style={{ fontFamily: fontOption.value }}>{fontOption.label}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Font Size</Label>
                <Select
                  value={String(editorFontSize)}
                  onValueChange={(v) => {
                    const size = Number(v);
                    emitFontChange({
                      uiFontFamily: uiFont,
                      uiFontSize,
                      editorFontFamily: editorFont,
                      editorFontSize: size,
                    });
                  }}
                >
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
              <span className="text-blue-500">SELECT</span> id, name, created_at<br />
              <span className="text-blue-500">FROM</span> users<br />
              <span className="text-blue-500">WHERE</span> status = <span className="text-green-500">'active'</span>;
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={resetFontDefaults}
              className="h-7 text-xs px-2 hover:bg-transparent hover:text-destructive"
            >
              Reset
            </Button>
          </div>
        </div>
      </div>

      {/* Editor colors */}
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
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const nextEditor: EditorConfig = {
                      ...editor,
                      light: defaultTokenColorsLight ?? ({} as TokenColors),
                      dark: defaultTokenColorsDark ?? ({} as TokenColors),
                    };
                    handleEditorChange(nextEditor);
                  }}
                  className="h-7 text-xs px-2 hover:bg-transparent hover:text-destructive"
                >
                  Reset
                </Button>
              </div>
            </div>
            <TabsContent value="light" className="mt-0">
              {renderColorGrid("light")}
            </TabsContent>
            <TabsContent value="dark" className="mt-0">
              {renderColorGrid("dark")}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

