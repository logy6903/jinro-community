import Anthropic from "@anthropic-ai/sdk";

// Shared Claude client for builder server code (AI blocks, 생기부 generation).
// Lazily constructed; null when ANTHROPIC_API_KEY is unset so callers can
// gracefully degrade (AI features off, everything else keeps working).

let client: Anthropic | null | undefined;

export function getAnthropicClient(): Anthropic | null {
  if (client !== undefined) return client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  client = apiKey ? new Anthropic({ apiKey }) : null;
  return client;
}

export function isAiConfigured(): boolean {
  return getAnthropicClient() !== null;
}
