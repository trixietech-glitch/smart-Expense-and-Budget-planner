import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

export function createAiGatewayProvider(apiKey: string) {
  return createOpenAICompatible({
    name: "ai-gateway",
    baseURL: process.env.AI_GATEWAY_BASE_URL || "https://api.openai.com/v1",
    headers: { Authorization: `Bearer ${apiKey}` },
  });
}
