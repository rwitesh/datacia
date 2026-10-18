import { StateField, StateEffect, EditorState, Prec } from "@codemirror/state";
import {
  EditorView,
  Decoration,
  type DecorationSet,
  WidgetType,
  ViewPlugin,
  ViewUpdate,
  keymap,
} from "@codemirror/view";
import { closeCompletion } from "@codemirror/autocomplete";

// InlineHint is suggested text shown after the cursor at pos; Tab accepts it.
interface InlineHint {
  text: string;
  pos: number;
}

interface GhostTextConfig {
  delay?: number;
  minInputLength?: number;
  getSuggestion: (input: string) => Promise<string>;
}

const setInlineHint = StateEffect.define<InlineHint>();
const clearInlineHint = StateEffect.define<void>();

const inlineHintField = StateField.define<InlineHint | null>({
  create: () => null,

  update(value, tr): InlineHint | null {
    for (const effect of tr.effects) {
      if (effect.is(setInlineHint)) return effect.value;
      if (effect.is(clearInlineHint)) return null;
    }
    if (!value) return null;

    // Typing the hint's next characters shrinks it; any other edit drops it.
    if (tr.docChanged) {
      let insertedText = "";
      tr.changes.iterChanges((fromA, toA, _fromB, _toB, inserted) => {
        if (fromA <= value.pos && toA >= value.pos) {
          insertedText = inserted.toString();
        }
      });
      if (
        insertedText.length === 0 ||
        value.text.slice(0, insertedText.length).toLowerCase() !== insertedText.toLowerCase()
      ) {
        return null;
      }
      const remaining = value.text.slice(insertedText.length);
      return remaining ? { text: remaining, pos: tr.changes.mapPos(value.pos, 1) } : null;
    }

    if (tr.selection && tr.selection.main.head !== value.pos) return null;
    return value;
  },
});

class GhostTextWidget extends WidgetType {
  constructor(readonly text: string) {
    super();
  }

  eq(other: GhostTextWidget): boolean {
    return this.text === other.text;
  }

  toDOM(): HTMLElement {
    const span = document.createElement("span");
    span.className = "cm-ghost-text";
    span.textContent = this.text;
    return span;
  }

  ignoreEvent(): boolean {
    return true;
  }
}

const ghostTextPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = this.createDecorations(view.state);
    }

    update(update: ViewUpdate) {
      if (
        update.docChanged ||
        update.selectionSet ||
        update.transactions.some((tr) =>
          tr.effects.some((e) => e.is(setInlineHint) || e.is(clearInlineHint))
        )
      ) {
        this.decorations = this.createDecorations(update.state);
      }
    }

    createDecorations(state: EditorState): DecorationSet {
      const hint = state.field(inlineHintField);
      if (!hint || !hint.text) return Decoration.none;
      const widget = Decoration.widget({ widget: new GhostTextWidget(hint.text), side: 1 });
      return Decoration.set([widget.range(hint.pos)]);
    }
  },
  { decorations: (v) => v.decorations }
);

function acceptGhostText(view: EditorView): boolean {
  const hint = view.state.field(inlineHintField);
  if (!hint || !hint.text) return false;
  view.dispatch({
    changes: { from: hint.pos, insert: hint.text },
    selection: { anchor: hint.pos + hint.text.length },
    effects: clearInlineHint.of(undefined),
  });
  return true;
}

function dismissGhostText(view: EditorView): boolean {
  if (!view.state.field(inlineHintField)) return false;
  view.dispatch({ effects: clearInlineHint.of(undefined) });
  return true;
}

// Highest precedence so Tab accepts the hint instead of indenting.
const ghostTextKeymap = Prec.highest(
  keymap.of([
    { key: "Tab", run: acceptGhostText },
    { key: "Escape", run: dismissGhostText },
  ])
);

// createIdleTrigger fetches a suggestion once typing pauses for delay ms.
function createIdleTrigger({ delay = 400, minInputLength = 3, getSuggestion }: GhostTextConfig) {
  return ViewPlugin.fromClass(
    class {
      private timer: ReturnType<typeof setTimeout> | null = null;
      // Bumped on every edit and on destroy, so older responses are dropped.
      private requestId = 0;
      // The input of the last applied response, so a dismissed hint isn't
      // fetched again when the same text comes back.
      private lastInput = "";

      destroy() {
        this.requestId++;
        if (this.timer) clearTimeout(this.timer);
      }

      update(update: ViewUpdate) {
        if (!update.docChanged) return;
        this.requestId++;
        if (this.timer) clearTimeout(this.timer);
        this.timer = setTimeout(() => this.fetchSuggestion(update.view), delay);
      }

      private async fetchSuggestion(view: EditorView) {
        const state = view.state;
        const pos = state.selection.main.head;
        const input = state.doc.sliceString(0, pos).trim();
        if (input.length < minInputLength) {
          this.clearHint(view);
          return;
        }
        if (input === this.lastInput) return;

        const requestId = ++this.requestId;
        try {
          const suggestion = await getSuggestion(input);
          // Drop the response if the user typed, the view was destroyed, or
          // the cursor moved while waiting.
          if (
            requestId !== this.requestId ||
            view.state.doc !== state.doc ||
            view.state.selection.main.head !== pos
          ) {
            return;
          }
          this.lastInput = input;
          if (suggestion) {
            view.dispatch({ effects: setInlineHint.of({ text: suggestion, pos }) });
            closeCompletion(view);
          } else {
            this.clearHint(view);
          }
        } catch {
          if (requestId === this.requestId) this.clearHint(view);
        }
      }

      private clearHint(view: EditorView) {
        if (view.state.field(inlineHintField)) {
          view.dispatch({ effects: clearInlineHint.of(undefined) });
        }
      }
    }
  );
}

// ghostText shows inline suggestions after a typing pause.
export function ghostText(config: GhostTextConfig) {
  return [inlineHintField, ghostTextPlugin, ghostTextKeymap, createIdleTrigger(config)];
}
