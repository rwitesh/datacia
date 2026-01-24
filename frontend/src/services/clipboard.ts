import { useMutation } from "@tanstack/react-query";
import { CopyToClipboard } from "./bindings/clipboard";

export function useCopyToClipboard() {
  return useMutation({
    mutationFn: async ({ content, type }: { content: string; type: string }) => {
      return CopyToClipboard(content, type);
    },
  });
}
