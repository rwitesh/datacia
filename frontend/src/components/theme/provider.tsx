import { useEffect, useState } from "react"
import { useSettings, useUpdateSettings } from "@/services/settings"
import { ThemeConfig } from "@/services/settings"
import { useQueryClient } from "@tanstack/react-query"
import { ThemeProviderContext, type Theme, EMPTY_TOKEN_COLORS, initialState } from "./context"
import { Events } from "@wailsio/runtime"

type ThemeProviderProps = {
  children: React.ReactNode
}

export function ThemeProvider({
  children,
  ...props
}: ThemeProviderProps) {
  const { data: settings } = useSettings();
  const { mutate: updateSettings } = useUpdateSettings();
  const [resolvedTheme, setResolvedTheme] = useState<"dark" | "light">("dark");
  const queryClient = useQueryClient();

  const theme = (settings?.settings?.theme as Theme) || "system";
  const editorLight = settings?.settings?.editor?.light;
  const editorDark = settings?.settings?.editor?.dark;
  const defaultLight = settings?.defaultTokenColorsLight;
  const defaultDark = settings?.defaultTokenColorsDark;

  const tokenColors =
    (resolvedTheme === "dark" ? editorDark : editorLight) ??
    (resolvedTheme === "dark" ? defaultDark : defaultLight) ??
    EMPTY_TOKEN_COLORS;

  const font = settings?.settings?.font;
  const editorFontFamily = font?.editorFontFamily ?? initialState.editorFontFamily;
  const editorFontSize = font?.editorFontSize ?? initialState.editorFontSize;
  const uiFontFamily = font?.uiFontFamily ?? initialState.uiFontFamily;
  const uiFontSize = font?.uiFontSize ?? initialState.uiFontSize;



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
      queryClient.invalidateQueries({ queryKey: ["settings"] });
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
      if (!settings) return;
      const newSettings = {
        ...settings.settings,
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
