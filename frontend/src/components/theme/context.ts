import { createContext } from "react"
import type { TokenColors } from "@/services/appInfo"

export type Theme = "dark" | "light" | "system"

export const DEFAULT_EDITOR_FONT_FAMILY = "JetBrains Mono"
export const DEFAULT_EDITOR_FONT_SIZE = 14
export const DEFAULT_UI_FONT_FAMILY = "Inter"
export const DEFAULT_UI_FONT_SIZE = 14

export type ThemeProviderState = {
  theme: Theme
  resolvedTheme: "dark" | "light"
  tokenColors?: TokenColors
  editorFontFamily: string
  editorFontSize: number
  uiFontFamily: string
  uiFontSize: number
  setTheme: (theme: Theme) => void
}

export const initialState: ThemeProviderState = {
  theme: "system",
  resolvedTheme: "dark",
  editorFontFamily: DEFAULT_EDITOR_FONT_FAMILY,
  editorFontSize: DEFAULT_EDITOR_FONT_SIZE,
  uiFontFamily: DEFAULT_UI_FONT_FAMILY,
  uiFontSize: DEFAULT_UI_FONT_SIZE,
  setTheme: () => null,
}

export const ThemeProviderContext = createContext<ThemeProviderState>(initialState)
