import { createContext } from "react"
import { ThemeConfig, type TokenColors } from "@/services/settings"

export type Theme = "dark" | "light" | "system"

export const themeConfigs: Record<Theme, ThemeConfig> = {
  dark: ThemeConfig.ThemeDark,
  light: ThemeConfig.ThemeLight,
  system: ThemeConfig.ThemeSystem,
}

// Used until the settings load; the colors themselves come from the backend.
export const EMPTY_TOKEN_COLORS: TokenColors = {
  keyword: "",
  string: "",
  number: "",
  comment: "",
  function: "",
  variable: "",
  type: "",
  operator: "",
}

export const DEFAULT_FONT_FAMILY = "JetBrains Mono"
export const DEFAULT_FONT_SIZE = 12

export type ThemeProviderState = {
  theme: Theme
  resolvedTheme: "dark" | "light"
  tokenColors: TokenColors
  editorFontFamily: string
  editorFontSize: number
  setTheme: (theme: Theme) => void
}

export const ThemeProviderContext = createContext<ThemeProviderState>({
  theme: "system",
  resolvedTheme: "dark",
  tokenColors: EMPTY_TOKEN_COLORS,
  editorFontFamily: DEFAULT_FONT_FAMILY,
  editorFontSize: DEFAULT_FONT_SIZE,
  setTheme: () => null,
})
