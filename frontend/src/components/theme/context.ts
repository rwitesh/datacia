import { createContext } from "react"
import type { TokenColors } from "@/services/settings"

export type Theme = "dark" | "light" | "system"

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
  editorFontSize: 14,
  uiFontFamily: "JetBrains Mono",
  uiFontSize: 14,
  setTheme: () => null,
}

export const ThemeProviderContext = createContext<ThemeProviderState>(initialState)
