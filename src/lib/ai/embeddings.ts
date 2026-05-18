import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/env";

const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

export async function getEmbedding(text: string): Promise<number[]> {
  const response = await anthropic.embeddings.create({
    model: "claude-3-haiku-20240307",
    input: text,
  });
  return response.embedding;
}

export async function getEmbeddings(texts: string[]): Promise<number[][]> {
  const response = await anthropic.embeddings.create({
    model: "claude-3-haiku-20240307",
    input: texts,
  });
  return response.embeddings.map((e) => e.embedding);
}
