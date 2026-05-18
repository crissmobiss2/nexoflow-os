import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/env";
import { loadBrainContext } from "./brain-context";
import {
  SCORING_PROMPT,
  SCOPE_PROMPT,
  ARCHITECTURE_PROMPT,
  CODE_GEN_PROMPT,
} from "./prompts";

const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

const SONNET = "claude-sonnet-4-6";
const HAIKU = "claude-haiku-4-5-20251001";

// ─── Opportunity Scoring ──────────────────────────────────────────────────────

export type ScoreResult = {
  marketSize: number;
  problemClarity: number;
  competitiveGap: number;
  revenueModel: number;
  teamFit: number;
  timeToValue: number;
  strategicAlignment: number;
  totalScore: number;
  decision: "pass" | "conditional" | "build" | "prioritise";
  rationale: string;
};

export async function scoreOpportunity(brief: string): Promise<ScoreResult> {
  const context = await loadBrainContext(["commercial"]);
  const prompt = SCORING_PROMPT(brief, context);

  const message = await anthropic.messages.create({
    model: HAIKU,
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  const text = message.content[0]?.type === "text" ? message.content[0].text : "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch?.[0]) throw new Error("Failed to parse scoring response");

  return JSON.parse(jsonMatch[0]) as ScoreResult;
}

// ─── Scope Document ───────────────────────────────────────────────────────────

export type ScopeResult = {
  content: string;
  promptTokens: number;
  completionTokens: number;
};

export async function generateScope(brief: string): Promise<ScopeResult> {
  const context = await loadBrainContext(["playbooks", "commercial", "product"]);
  const prompt = SCOPE_PROMPT(brief, context);

  const message = await anthropic.messages.create({
    model: SONNET,
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
  });

  const content = message.content[0]?.type === "text" ? message.content[0].text : "";

  return {
    content,
    promptTokens: message.usage.input_tokens,
    completionTokens: message.usage.output_tokens,
  };
}

// ─── Architecture ─────────────────────────────────────────────────────────────

export async function generateArchitecture(
  brief: string,
  scopeDoc: string,
): Promise<ScopeResult> {
  const context = await loadBrainContext(["standards", "tech", "playbooks"]);
  const prompt = ARCHITECTURE_PROMPT(brief, scopeDoc, context);

  const message = await anthropic.messages.create({
    model: SONNET,
    max_tokens: 6000,
    messages: [{ role: "user", content: prompt }],
  });

  const content = message.content[0]?.type === "text" ? message.content[0].text : "";

  return {
    content,
    promptTokens: message.usage.input_tokens,
    completionTokens: message.usage.output_tokens,
  };
}

// ─── Code Generation (streaming) ──────────────────────────────────────────────

export async function* generateCodeStream(
  projectName: string,
  stack: string,
  architecture: string,
): AsyncGenerator<string> {
  const context = await loadBrainContext(["standards", "tech"]);
  const prompt = CODE_GEN_PROMPT(projectName, stack, architecture, context);

  const stream = anthropic.messages.stream({
    model: SONNET,
    max_tokens: 8000,
    messages: [{ role: "user", content: prompt }],
  });

  for await (const event of stream) {
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "text_delta"
    ) {
      yield event.delta.text;
    }
  }
}
