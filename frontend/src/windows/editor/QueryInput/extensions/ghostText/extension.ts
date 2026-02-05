import {
  StateField,
  StateEffect,
  Transaction,
  EditorState,
  Prec,
} from "@codemirror/state";
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

// Types
interface InlineHint {
  text: string;
  pos: number;
  inputLength: number;
}

/**
 * Function type for getting ghost text suggestions (input only; engine is handled by the caller).
 */
export type GetSuggestionFn = (currentInput: string) => Promise<string>;

export interface GhostTextConfig {
  delay?: number;
  minInputLength?: number;
  /** Function to fetch suggestions. Extension is disabled if not provided. */
  getSuggestion?: GetSuggestionFn;
}

// State Effects
export const setInlineHint = StateEffect.define<{
  text: string;
  pos: number;
  inputLength: number;
}>();
export const clearInlineHint = StateEffect.define<void>();

// State Field to store the current hint
export const inlineHintField = StateField.define<InlineHint | null>({
  create: () => null,

  update(value, tr: Transaction): InlineHint | null {
    // Handle explicit effects first
    for (const effect of tr.effects) {
      if (effect.is(setInlineHint)) {
        return {
          text: effect.value.text,
          pos: effect.value.pos,
          inputLength: effect.value.inputLength,
        };
      }
      if (effect.is(clearInlineHint)) {
        return null;
      }
    }

    // If no hint exists, nothing to update
    if (!value) return null;

    // Handle document changes (over-typing support)
    if (tr.docChanged) {
      const newPos = tr.changes.mapPos(value.pos, 1);

      // Get the text that was inserted
      let insertedText = "";
      tr.changes.iterChanges((fromA, toA, _fromB, _toB, inserted) => {
        if (fromA <= value.pos && toA >= value.pos) {
          insertedText = inserted.toString();
        }
      });

      // If user typed something
      if (insertedText.length > 0) {
        const hintStart = value.text.slice(0, insertedText.length);
        if (
          hintStart.toLowerCase() === insertedText.toLowerCase() ||
          hintStart === insertedText
        ) {
          // Shrink the hint (predictive matching)
          const remainingHint = value.text.slice(insertedText.length);
          if (remainingHint.length === 0) {
            return null;
          }
          return {
            text: remainingHint,
            pos: newPos,
            inputLength: value.inputLength + insertedText.length,
          };
        } else {
          return null;
        }
      }

      return null;
    }

    // Clear hint on selection change (cursor movement)
    if (tr.selection) {
      const mainHead = tr.selection.main.head;
      if (mainHead !== value.pos) {
        return null;
      }
    }

    return value;
  },
});

// Widget to render the ghost text
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

// View Plugin to render decorations
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
          tr.effects.some(
            (e) => e.is(setInlineHint) || e.is(clearInlineHint)
          )
        )
      ) {
        this.decorations = this.createDecorations(update.state);
      }
    }

    createDecorations(state: EditorState): DecorationSet {
      const hint = state.field(inlineHintField);
      if (!hint || !hint.text) {
        return Decoration.none;
      }

      const widget = Decoration.widget({
        widget: new GhostTextWidget(hint.text),
        side: 1,
      });

      return Decoration.set([widget.range(hint.pos)]);
    }
  },
  {
    decorations: (v) => v.decorations,
  }
);

// Command to accept the ghost text
function acceptGhostText(view: EditorView): boolean {
  const hint = view.state.field(inlineHintField);
  if (!hint || !hint.text) {
    return false;
  }

  view.dispatch({
    changes: { from: hint.pos, insert: hint.text },
    selection: { anchor: hint.pos + hint.text.length },
    effects: clearInlineHint.of(undefined),
  });

  return true;
}

// Command to dismiss the ghost text
function dismissGhostText(view: EditorView): boolean {
  const hint = view.state.field(inlineHintField);
  if (!hint) {
    return false;
  }

  view.dispatch({
    effects: clearInlineHint.of(undefined),
  });

  return true;
}

// Keymap with highest precedence for Tab
const ghostTextKeymap = Prec.highest(
  keymap.of([
    { key: "Tab", run: acceptGhostText },
    { key: "Escape", run: dismissGhostText },
  ])
);

// Create the idle trigger plugin (per-instance state for timer & request tracking)
function createIdleTrigger(config: GhostTextConfig) {
  const { delay = 400, minInputLength = 3, getSuggestion} = config;

  // If no getSuggestion function provided, return a no-op plugin
  if (!getSuggestion) {
    return ViewPlugin.fromClass(class {});
  }

  return ViewPlugin.fromClass(
    class {
      private timer: ReturnType<typeof setTimeout> | null = null;
      private requestId = 0; // Track request version to ignore stale responses
      private lastInput = ""; // Dedup same input

      destroy() {
        if (this.timer) {
          clearTimeout(this.timer);
          this.timer = null;
        }
      }

      update(update: ViewUpdate) {
        if (!update.docChanged) return;

        // Clear pending timer on new input
        if (this.timer) {
          clearTimeout(this.timer);
          this.timer = null;
        }

        this.timer = setTimeout(() => this.fetchSuggestion(update.view), delay);
      }

      private async fetchSuggestion(view: EditorView) {
        const state = view.state;
        const pos = state.selection.main.head;
        const docTextBeforeCursor = state.doc.sliceString(0, pos);
        const currentInput = docTextBeforeCursor.trim();

        // Skip if input too short
        if (currentInput.length < minInputLength) {
          this.clearHintIfExists(view);
          return;
        }

        // Skip if same input as last request (dedup)
        if (currentInput === this.lastInput) {
          return;
        }
        this.lastInput = currentInput;

        // Increment request ID to track this request
        const thisRequestId = ++this.requestId;

        try {
          const suggestion = await getSuggestion(currentInput);

          // Ignore stale response (user typed more while waiting)
          if (thisRequestId !== this.requestId) {
            return;
          }

          if (suggestion && suggestion.length > 0) {
            view.dispatch({
              effects: setInlineHint.of({
                text: suggestion,
                pos: view.state.selection.main.head, // Use current pos, not stale
                inputLength: currentInput.length,
              }),
            });
            closeCompletion(view);
          } else {
            this.clearHintIfExists(view);
          }
        } catch {
          // Ignore stale errors too
          if (thisRequestId === this.requestId) {
            this.clearHintIfExists(view);
          }
        }
      }

      private clearHintIfExists(view: EditorView) {
        const existingHint = view.state.field(inlineHintField);
        if (existingHint) {
          view.dispatch({ effects: clearInlineHint.of(undefined) });
        }
      }
    }
  );
}

// Export the complete extension bundle
export function ghostText(config: GhostTextConfig) {
  return [
    inlineHintField,
    ghostTextPlugin,
    ghostTextKeymap,
    createIdleTrigger(config),
  ];
}
