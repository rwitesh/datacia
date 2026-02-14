import { SendMessage as WSendMessage } from "../../../bindings/datacia/internal/ai/service";

export async function SendMessage(
  engine: string,
  context: string,
  message: string,
  model: string
): Promise<string> {
  return WSendMessage(engine, context, message, model);
}
