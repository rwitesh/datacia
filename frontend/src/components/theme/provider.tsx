import { useEffect, useState } from "react"
import { useSettings, useUpdateSettings } from "@/services/settings"
import { ThemeConfig } from "@/services/settings"
import { useQueryClient } from "@tanstack/react-query"
import { ThemeProviderContext, type Theme, EMPTY_TOKEN_COLORS, initialState } from "./context"
import { Events } from "@wailsio/runtime"

export function ThemeProvider({ children, ...props }: { children: React.ReactNode }) {
  const { data: settings } = useSettings()
  const { mutate: updateSettings } = useUpdateSettings()
  const [resolvedTheme, setResolvedTheme] = useState<"dark" | "light">("dark")
  const queryClient = useQueryClient()

  const theme = (settings?.settings?.theme as Theme) ?? "system"
  const { font, editor } = settings?.settings ?? {}
  const tokenColors =
    (resolvedTheme === "dark" ? editor?.dark : editor?.light) ??
    (resolvedTheme === "dark" ? settings?.defaultTokenColorsDark : settings?.defaultTokenColorsLight) ??
    EMPTY_TOKEN_COLORS

  const editorFontFamily = font?.editorFontFamily ?? initialState.editorFontFamily
  const editorFontSize = font?.editorFontSize ?? initialState.editorFontSize
  const uiFontFamily = font?.uiFontFamily ?? initialState.uiFontFamily
  const uiFontSize = font?.uiFontSize ?? initialState.uiFontSize

  // Handle theme class + system media query listener
  useEffect(() => {
    const root = window.document.documentElement
    root.classList.remove("light", "dark")

    if (theme === "system") {
      const media = window.matchMedia("(prefers-color-scheme: dark)")
      const applySystemTheme = (dark: boolean) => {
        const next = dark ? "dark" : "light"
        root.classList.remove("light", "dark")
        root.classList.add(next)
        setResolvedTheme(next)
      }

      applySystemTheme(media.matches)
      const listener = (e: MediaQueryListEvent) => applySystemTheme(e.matches)
      media.addEventListener("change", listener)
      return () => media.removeEventListener("change", listener)
    }

    root.classList.add(theme)
    setResolvedTheme(theme)
  }, [theme])

  // Sync settings when changed from another window
  useEffect(() => {
    const unsubscribe = Events.On("app:settings-changed", () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] })
    })
    return () => unsubscribe()
  }, [queryClient])

  // Apply font CSS variables
  useEffect(() => {
    const root = window.document.documentElement
    root.style.setProperty("--app-ui-font", `'${uiFontFamily}'`)
    root.style.setProperty("--app-ui-font-size", `${uiFontSize}px`)
    root.style.setProperty("--app-editor-font", `'${editorFontFamily}'`)
    root.style.setProperty("--app-editor-font-size", `${editorFontSize}px`)
  }, [uiFontFamily, uiFontSize, editorFontFamily, editorFontSize])

  return (
    <ThemeProviderContext.Provider
      {...props}
      value={{
        theme,
        resolvedTheme,
        tokenColors,
        editorFontFamily,
        editorFontSize,
        uiFontFamily,
        uiFontSize,
        setTheme: (newTheme: Theme) => {
          if (!settings) return
          updateSettings({ ...settings.settings, theme: newTheme as unknown as ThemeConfig })
        },
      }}
    >
      {children}
    </ThemeProviderContext.Provider>
  )
}