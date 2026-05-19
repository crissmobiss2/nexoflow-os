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

export function computeCosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    magA += a[i]! * a[i]!;
    magB += b[i]! * b[i]!;
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}
