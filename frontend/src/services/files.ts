import { useMutation } from "@tanstack/react-query";
import { SaveFile } from "./bindings/files";

export function useSaveFile() {
  return useMutation({
    mutationFn: async ({ filename, content }: { filename: string; content: string }) => {
      return SaveFile(filename, content);
    },
  });
}
