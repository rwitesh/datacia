import { SaveFile as WSaveFile } from "../../../bindings/datacia/internal/files/fileservice";

/**
 * Save content to a file, prompting the user to choose a location
 * @returns The path of the saved file, or empty string if cancelled
 */
export async function SaveFile(filename: string, content: string): Promise<string> {
  if (!filename?.trim()) {
    throw new Error("Filename cannot be empty");
  }
  if (content === undefined || content === null) {
    throw new Error("Content cannot be null or undefined");
  }
  return WSaveFile(filename, content);
}
