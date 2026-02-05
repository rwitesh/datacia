/**
 * Ghost Text Extension for CodeMirror
 *
 * Provides inline completion suggestions (ghost text) that appear as
 * grayed-out text after the cursor. Shows suggestions after a typing
 * pause and allows Tab to accept them.
 *
 * This module is independent of any specific suggestion source - the
 * caller provides a `getSuggestion` function via config.
 */

export { ghostText, type GhostTextConfig, type GetSuggestionFn } from "./extension";
