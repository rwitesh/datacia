import { SetContent as WSetContent } from "../../../bindings/datacia/internal/clipboard/clipboardservice";

/**
 * Copy text to the system clipboard
 */
export async function CopyToClipboard(content: string, type: string): Promise<void> {
  if (!content) {
    throw new Error("Content cannot be empty");
  }
  return WSetContent(content, type);
}
