import { useMutation } from "@tanstack/react-query";
import { CopyToClipboard } from "./bindings/clipboard";

export function useCopyToClipboard() {
  return useMutation({
    mutationFn: async (text: string) => {
      return CopyToClipboard(text);
    },
  });
}
