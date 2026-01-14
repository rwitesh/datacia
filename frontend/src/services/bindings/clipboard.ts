import { SetText as WSetText } from "../../../bindings/datacia/internal/clipboard/clipboardservice";

/**
 * Copy text to the system clipboard
 */
export async function CopyToClipboard(text: string): Promise<void> {
  if (!text?.trim()) {
    throw new Error("Text cannot be empty");
  }
  return WSetText(text);
}
