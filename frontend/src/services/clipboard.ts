import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { errorMessage } from "@/lib/utils";
import { CopyToClipboard } from "./bindings/clipboard";

export function useCopyToClipboard() {
  return useMutation({
    mutationFn: async ({ content, type }: { content: string; type: string }) => {
      return CopyToClipboard(content, type);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });
}
