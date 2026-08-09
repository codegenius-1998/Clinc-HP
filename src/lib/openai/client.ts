import OpenAI from "openai";

export function getOpenAIClient(): OpenAI {
  return new OpenAI();
}
