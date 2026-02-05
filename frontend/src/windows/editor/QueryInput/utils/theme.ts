import { EditorView } from "@codemirror/view";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";

export const DEFAULT_LIGHT_COLORS: Record<string, string> = {
  keyword: "#d73a49",
  string: "#032f62",
  number: "#005cc5",
  comment: "#6a737d",
  function: "#6f42c1",
  variable: "#24292e",
  type: "#e36209",
  operator: "#24292e",
};

export const DEFAULT_DARK_COLORS: Record<string, string> = {
  keyword: "#ff7b72",
  string: "#a5d6ff",
  number: "#79c0ff",
  comment: "#8b949e",
  function: "#d2a8ff",
  variable: "#c9d1d9",
  type: "#ffa657",
  operator: "#c9d1d9",
};

type TokenColors = {
  keyword?: string;
  string?: string;
  number?: string;
  comment?: string;
  function?: string;
  variable?: string;
  type?: string;
  operator?: string;
};


function createHighlightStyle(colors: Required<TokenColors>) {
  return HighlightStyle.define([
    { tag: t.keyword, color: colors.keyword, fontWeight: "bold" },
    { tag: [t.name, t.deleted, t.character, t.propertyName, t.macroName], color: colors.variable },
    { tag: [t.function(t.variableName), t.labelName], color: colors.function },
    { tag: [t.color, t.constant(t.name), t.standard(t.name)], color: colors.number },
    { tag: [t.definition(t.name), t.separator], color: colors.variable },
    { tag: [t.typeName, t.className, t.number, t.changed, t.annotation, t.modifier, t.self, t.namespace], color: colors.type },
    { tag: [t.operator, t.operatorKeyword, t.url, t.escape, t.regexp, t.link, t.special(t.string)], color: colors.operator },
    { tag: [t.meta, t.comment], color: colors.comment, fontStyle: "italic" },
    { tag: t.strong, fontWeight: "bold" },
    { tag: t.emphasis, fontStyle: "italic" },
    { tag: t.strikethrough, textDecoration: "line-through" },
    { tag: t.link, color: colors.string, textDecoration: "underline" },
    { tag: t.heading, fontWeight: "bold", color: colors.keyword },
    { tag: [t.atom, t.bool, t.special(t.variableName)], color: colors.number },
    { tag: [t.processingInstruction, t.string, t.inserted], color: colors.string },
    { tag: t.invalid, color: colors.keyword },
  ]);
}

export const getTheme = (
  isDark: boolean,
  settings: {
    colors?: TokenColors;
    fontFamily: string;
    fontSize: number;
  }
) => {
  const { colors = {}, fontFamily, fontSize } = settings;
  const defaults = isDark ? DEFAULT_DARK_COLORS : DEFAULT_LIGHT_COLORS;

  // Merge defaults with user settings, preferring user settings only if they are not empty
  const finalColors = { ...defaults } as Required<TokenColors>;
  Object.keys(colors).forEach((key) => {
    const k = key as keyof TokenColors;
    if (colors[k]) {
      finalColors[k] = colors[k]!;
    }
  });

  const baseTheme = EditorView.theme({
    "&": {
      height: "100%",
      fontFamily: fontFamily,
      fontSize: `${fontSize}px`,
      backgroundColor: "transparent",
      color: "inherit",
      outline: "none",
    },
    ".cm-content": {
      fontFamily: fontFamily,
    },
    ".cm-gutters": {
      fontFamily: fontFamily,
    },
    ".cm-tooltip": {
      fontFamily: fontFamily,
      fontSize: `${Math.max(12, fontSize * 0.85)}px`,
    },
    ".cm-tooltip.cm-tooltip-autocomplete": {
      backgroundColor: "var(--popover)",
      color: "var(--popover-foreground)",
      border: "1px solid var(--border)",
      borderRadius: "var(--radius)",
      boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
    },
    ".cm-tooltip.cm-tooltip-autocomplete > ul": {
      fontFamily: fontFamily,
    },
    ".cm-tooltip.cm-tooltip-autocomplete > ul > li": {
      padding: "6px 8px",
      lineHeight: "1.5",
      display: "block",
    },
    ".cm-tooltip.cm-tooltip-autocomplete > ul > li[aria-selected]": {
      backgroundColor: "var(--accent)",
      color: "var(--accent-foreground)",
    },
    ".cm-completionDetail": {
      color: "var(--muted-foreground)",
      fontStyle: "italic",
      float: "right",
    },
    ".cm-completionIcon": {
      display: "none",
    },
    ".cm-completionMatchedText": {
      textDecoration: "none",
      color: isDark ? "#60a5fa" : "#2563eb",
      fontWeight: "bold",
    },
    // Ghost text styling - wraps naturally within the editor
    ".cm-ghost-text": {
      color: isDark ? "rgba(139, 148, 158, 0.7)" : "rgba(106, 115, 125, 0.7)",
      fontStyle: "italic",
      whiteSpace: "pre-wrap",
      wordBreak: "break-word",
      overflowWrap: "anywhere",
      pointerEvents: "none",
    },
  }, { dark: isDark });

  return [baseTheme, syntaxHighlighting(createHighlightStyle(finalColors))];
};
