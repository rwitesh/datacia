import { SendMessage as WSendMessage } from "../../../bindings/datacia/internal/ai/service";

export async function SendMessage(engine: string, context: string, message: string): Promise<string> {
  return WSendMessage(engine, context, message);
}
