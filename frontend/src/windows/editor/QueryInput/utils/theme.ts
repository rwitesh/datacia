import { EditorView } from "@codemirror/view";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";
import type { TokenColors } from "@/services/settings";

function createHighlightStyle(colors: TokenColors) {
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
    colors: TokenColors;
    fontFamily: string;
    fontSize: number;
  }
) => {
  const { colors, fontFamily, fontSize } = settings;
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

  return [baseTheme, syntaxHighlighting(createHighlightStyle(colors))];
};
