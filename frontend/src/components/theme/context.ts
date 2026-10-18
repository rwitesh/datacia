import { createContext } from "react"
import { ThemeConfig, type TokenColors } from "@/services/settings"

export type Theme = "dark" | "light" | "system"

export const themeConfigs: Record<Theme, ThemeConfig> = {
  dark: ThemeConfig.ThemeDark,
  light: ThemeConfig.ThemeLight,
  system: ThemeConfig.ThemeSystem,
}

/** Placeholder so tokenColors is never undefined before settings load. No hex values defined in UI. */
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

export type ThemeProviderState = {
  theme: Theme
  resolvedTheme: "dark" | "light"
  tokenColors: TokenColors
  editorFontFamily: string
  editorFontSize: number
  uiFontFamily: string
  uiFontSize: number
  setTheme: (theme: Theme) => void
}

export const initialState: ThemeProviderState = {
  theme: "system",
  resolvedTheme: "dark",
  tokenColors: EMPTY_TOKEN_COLORS,
  editorFontFamily: "JetBrains Mono",
  editorFontSize: 12,
  uiFontFamily: "JetBrains Mono",
  uiFontSize: 12,
  setTheme: () => null,
}

export const ThemeProviderContext = createContext<ThemeProviderState>(initialState)
