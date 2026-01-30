import { EditorView } from "@codemirror/view";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";

const c = {
  background: "transparent",
  foreground: "#c9d1d9",
  selection: "#006affcf",
  selectionMatch: "#006affcf",
  cursor: "#c9d1d9",
  gutterBackground: "transparent",
  gutterForeground: "#8b949e",
  lineHighlight: "#161b22",
  keyword: "#ff5f54ff",
  string: "#a5d6ff",
  number: "#79c0ff",
  comment: "#8b949e",
  function: "#d2a8ff",
  variable: "#d9dc3bff",
  type: "#ffa657",
  operator: "#c9d1d9",
  bracket: "#c9d1d9",
};

const theme = EditorView.theme({
  "&": {
    height: "100%",
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    fontSize: "14px",
    backgroundColor: c.background,
    color: c.foreground,
  },
  ".cm-scroller": {
    fontFamily: "inherit",
    lineHeight: "1.6",
  },
  ".cm-content": {
    caretColor: c.cursor,
  },
  ".cm-cursor, .cm-dropCursor": {
    borderLeftColor: c.cursor,
  },
  "&.cm-focused .cm-cursor": {
    borderLeftColor: c.cursor,
  },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": {
    backgroundColor: c.selection,
  },
  ".cm-panels": {
    backgroundColor: c.gutterBackground,
    color: c.foreground,
  },
  ".cm-panels.cm-panels-top": {
    borderBottom: "1px solid " + c.lineHighlight,
  },
  ".cm-panels.cm-panels-bottom": {
    borderTop: "1px solid " + c.lineHighlight,
  },
  ".cm-searchMatch": {
    backgroundColor: c.selectionMatch,
    outline: `1px solid ${c.foreground}`,
  },
  ".cm-searchMatch.cm-searchMatch-selected": {
    backgroundColor: c.selection,
  },
  ".cm-activeLine": {
    backgroundColor: c.lineHighlight,
  },
  ".cm-selectionMatch": {
    backgroundColor: c.selectionMatch,
  },
  ".cm-matchingBracket, .cm-nonmatchingBracket": {
    backgroundColor: c.selectionMatch,
    outline: `1px solid ${c.foreground}`,
  },
  ".cm-foldPlaceholder": {
    backgroundColor: "transparent",
    border: "none",
    color: c.foreground,
  },
  ".cm-tooltip": {
    border: "1px solid " + c.lineHighlight,
    backgroundColor: c.gutterBackground,
    color: c.foreground,
  },
  ".cm-tooltip .cm-tooltip-arrow:before": {
    borderTopColor: c.lineHighlight,
    borderBottomColor: c.lineHighlight,
  },
  ".cm-tooltip .cm-tooltip-arrow:after": {
    borderTopColor: c.gutterBackground,
    borderBottomColor: c.gutterBackground,
  },
  ".cm-tooltip-autocomplete": {
    "& > ul > li": {
      transition: "background 100ms ease, color 100ms ease",
    },
    "& > ul > li[aria-selected]": {
      backgroundColor: c.selection,
      color: c.foreground,
    },
  },

  ".cm-completionIcon": {
    width: "auto",
    height: "auto",
    background: "none !important",
    paddingRight: "6px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#8b949e",
    fontSize: "11px",
    fontFamily: "'JetBrains Mono', monospace",
    opacity: 0.85,
  },

  ".cm-completionIcon-function::after": {
    content: '"function"',
    color: c.function,
  },

  ".cm-completionIcon-keyword::after": {
    content: '"keyword"',
    color: c.keyword,
  },

  ".cm-completionIcon-variable::after": {
    content: '"variable"',
    color: c.variable,
  },

  ".cm-completionIcon-property::after": {
    content: '"property"',   // SQL columns
    color: c.variable,
  },

  ".cm-completionIcon-type::after": {
    content: '"table"',
    color: c.type,
  },
}, { dark: true });

const highlightStyle = HighlightStyle.define([
  { tag: t.keyword, color: c.keyword, fontWeight: "bold" },
  { tag: [t.name, t.deleted, t.character, t.propertyName, t.macroName], color: c.variable },
  { tag: [t.function(t.variableName), t.labelName], color: c.function },
  { tag: [t.color, t.constant(t.name), t.standard(t.name)], color: c.number },
  { tag: [t.definition(t.name), t.separator], color: c.variable },
  { tag: [t.typeName, t.className, t.number, t.changed, t.annotation, t.modifier, t.self, t.namespace], color: c.type },
  { tag: [t.operator, t.operatorKeyword, t.url, t.escape, t.regexp, t.link, t.special(t.string)], color: c.operator },
  { tag: [t.meta, t.comment], color: c.comment, fontStyle: "italic" },
  { tag: t.strong, fontWeight: "bold" },
  { tag: t.emphasis, fontStyle: "italic" },
  { tag: t.strikethrough, textDecoration: "line-through" },
  { tag: t.link, color: c.string, textDecoration: "underline" },
  { tag: t.heading, fontWeight: "bold", color: c.keyword },
  { tag: [t.atom, t.bool, t.special(t.variableName)], color: c.number },
  { tag: [t.processingInstruction, t.string, t.inserted], color: c.string },
  { tag: t.invalid, color: c.keyword },
]);

export const defaultTheme = [theme, syntaxHighlighting(highlightStyle)];
