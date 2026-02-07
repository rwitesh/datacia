import { useMutation } from "@tanstack/react-query";
import { SendMessage } from "./bindings";

export function useSendAIMessage() {
  return useMutation({
    mutationFn: async (params: { engine: string; context: string; message: string }) => {
      return SendMessage(params.engine, params.context, params.message);
    },
  });
}
