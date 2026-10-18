import { useEffect, useMemo, useSyncExternalStore } from "react"
import { useSettings, useUpdateSettings } from "@/services/settings"
import { useQueryClient } from "@tanstack/react-query"
import {
  ThemeProviderContext,
  themeConfigs,
  type Theme,
  EMPTY_TOKEN_COLORS,
  DEFAULT_FONT_FAMILY,
  DEFAULT_FONT_SIZE,
} from "./context"
import { Events } from "@wailsio/runtime"
import { toast } from "sonner"
import { errorMessage } from "@/lib/utils"
import { queryKeys } from "@/services/queryKeys"

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { data: settings } = useSettings()
  const { mutate: updateSettings } = useUpdateSettings()
  const queryClient = useQueryClient()
  const systemDark = useSyncExternalStore(subscribeToSystemTheme, getSystemDark)

  const theme = (settings?.settings?.theme as Theme) ?? "system"
  const resolvedTheme: "dark" | "light" =
    theme === "system" ? (systemDark ? "dark" : "light") : theme
  const { font, editor } = settings?.settings ?? {}
  const tokenColors = (resolvedTheme === "dark" ? editor?.dark : editor?.light) ?? EMPTY_TOKEN_COLORS

  const editorFontFamily = font?.editorFontFamily ?? DEFAULT_FONT_FAMILY
  const editorFontSize = font?.editorFontSize ?? DEFAULT_FONT_SIZE
  const uiFontFamily = font?.uiFontFamily ?? DEFAULT_FONT_FAMILY
  const uiFontSize = font?.uiFontSize ?? DEFAULT_FONT_SIZE

  useEffect(() => {
    const root = window.document.documentElement
    root.classList.remove("light", "dark")
    root.classList.add(resolvedTheme)
  }, [resolvedTheme])

  // Another window may have saved new settings.
  useEffect(() => {
    const unsubscribe = Events.On("app:settings-changed", () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.settings })
    })
    return () => unsubscribe()
  }, [queryClient])

  useEffect(() => {
    const root = window.document.documentElement
    root.style.setProperty("--app-ui-font", `'${uiFontFamily}'`)
    root.style.setProperty("--app-ui-font-size", `${uiFontSize}px`)
    root.style.setProperty("--app-editor-font", `'${editorFontFamily}'`)
    root.style.setProperty("--app-editor-font-size", `${editorFontSize}px`)
  }, [uiFontFamily, uiFontSize, editorFontFamily, editorFontSize])

  const value = useMemo(
    () => ({
      theme,
      resolvedTheme,
      tokenColors,
      editorFontFamily,
      editorFontSize,
      setTheme: (newTheme: Theme) => {
        if (!settings) return
        updateSettings(
          { settings: { ...settings.settings, theme: themeConfigs[newTheme] } },
          { onError: (error) => toast.error(errorMessage(error)) },
        )
      },
    }),
    [theme, resolvedTheme, tokenColors, editorFontFamily, editorFontSize, settings, updateSettings],
  )

  return <ThemeProviderContext.Provider value={value}>{children}</ThemeProviderContext.Provider>
}

const darkSchemeQuery = "(prefers-color-scheme: dark)"

function subscribeToSystemTheme(onChange: () => void) {
  const media = window.matchMedia(darkSchemeQuery)
  media.addEventListener("change", onChange)
  return () => media.removeEventListener("change", onChange)
}

function getSystemDark() {
  return window.matchMedia(darkSchemeQuery).matches
}
