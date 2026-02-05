import { GetSuggestion as WGetSuggestion } from "../../../bindings/datacia/internal/intellisense/service";

/**
 * Gets a ghost text suggestion for the given SQL input from query history.
 * Engine is taken from current connection info so suggestions are scoped to the active engine.
 * @param currentInput - The SQL text the user has typed so far
 * @returns The best suggestion string, or empty string if no match found
 */
export async function GetSuggestion(currentInput: string, engine: string): Promise<string> {
  return WGetSuggestion(currentInput, engine);
}
