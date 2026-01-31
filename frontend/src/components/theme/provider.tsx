import { useEffect, useState } from "react"
import { useAppInfo, useUpdateSettings } from "@/services/appInfo"
import { ThemeConfig } from "@/services/appInfo"
import { useQueryClient } from "@tanstack/react-query"
import {
  ThemeProviderContext,
  type Theme,
  DEFAULT_EDITOR_FONT_FAMILY,
  DEFAULT_EDITOR_FONT_SIZE,
  DEFAULT_UI_FONT_FAMILY,
  DEFAULT_UI_FONT_SIZE,
} from "./context"
import { Events } from "@wailsio/runtime"

type ThemeProviderProps = {
  children: React.ReactNode
}

export function ThemeProvider({
  children,
  ...props
}: ThemeProviderProps) {
  const { data: appInfo } = useAppInfo();
  const { mutate: updateSettings } = useUpdateSettings();
  const [resolvedTheme, setResolvedTheme] = useState<"dark" | "light">("dark");
  const queryClient = useQueryClient();

  const theme = (appInfo?.settings?.theme as Theme) || 'system';
  const tokenColorsLight = appInfo?.settings?.editor?.tokenColorsLight;
  const tokenColorsDark = appInfo?.settings?.editor?.tokenColorsDark;

  const tokenColors = resolvedTheme === "dark"
    ? tokenColorsDark
    : tokenColorsLight;

  // Font values with defaults
  const editorFontFamily = appInfo?.settings?.font?.editorFontFamily || DEFAULT_EDITOR_FONT_FAMILY;
  const editorFontSize = appInfo?.settings?.font?.editorFontSize || DEFAULT_EDITOR_FONT_SIZE;
  const uiFontFamily = appInfo?.settings?.font?.uiFontFamily || DEFAULT_UI_FONT_FAMILY;
  const uiFontSize = appInfo?.settings?.font?.uiFontSize || DEFAULT_UI_FONT_SIZE;



  useEffect(() => {
    const root = window.document.documentElement

    root.classList.remove("light", "dark")

    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
        .matches
        ? "dark"
        : "light"

      root.classList.add(systemTheme)
      setResolvedTheme(systemTheme)
      return
    }

    root.classList.add(theme)
    setResolvedTheme(theme === "dark" ? "dark" : "light");
  }, [theme])

  useEffect(() => {
    if (theme !== "system") return;

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = (e: MediaQueryListEvent) => {
      const newTheme = e.matches ? "dark" : "light";
      const root = window.document.documentElement;
      root.classList.remove("light", "dark");
      root.classList.add(newTheme);
      setResolvedTheme(newTheme);
    };

    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, [theme]);

  // Listen for settings changes from other windows
  useEffect(() => {
    const unsubscribe = Events.On("app:settings-changed", () => {
      queryClient.invalidateQueries({ queryKey: ["app-info"] });
    });

    return () => unsubscribe();
  }, [queryClient]);

  // Apply font CSS variables to document root
  useEffect(() => {
    const root = window.document.documentElement;
    root.style.setProperty('--app-ui-font', `'${uiFontFamily}'`);
    root.style.setProperty('--app-ui-font-size', `${uiFontSize}px`);
    root.style.setProperty('--app-editor-font', `'${editorFontFamily}'`);
    root.style.setProperty('--app-editor-font-size', `${editorFontSize}px`);
  }, [uiFontFamily, uiFontSize, editorFontFamily, editorFontSize]);

  const value = {
    theme,
    resolvedTheme,
    tokenColors,
    editorFontFamily,
    editorFontSize,
    uiFontFamily,
    uiFontSize,
    setTheme: (newTheme: Theme) => {
      if (!appInfo) return;
      const newSettings = {
        ...appInfo.settings,
        theme: newTheme as unknown as ThemeConfig
      };
      updateSettings(newSettings);
    },
  }

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  )
}
