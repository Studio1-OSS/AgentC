import type { LlmProviderConfig } from "@agentc/protocol";

const MAX_TITLE_LENGTH = 48;
const TITLE_PROMPT =
  "Write a short, professional title (2 to 6 words, Title Case) for a coding session that starts with the user's request below. " +
  "Reply with the title only: no quotes, no trailing punctuation, no explanation.";

/** Short sidebar title for a session, from the model when it answers in time, else from the prompt itself. */
export async function titleFromPrompt(
  prompt: string,
  llm: LlmProviderConfig,
  timeoutMs = 10_000,
): Promise<string> {
  const text = prompt.replace(/\s+/g, " ").trim();
  if (!text) return "Untitled session";
  try {
    const title = cleanTitle(await askModel(text, llm, timeoutMs));
    if (title) return title;
  } catch {
    // fall through to the local title
  }
  return fallbackTitle(text);
}

async function askModel(
  prompt: string,
  llm: LlmProviderConfig,
  timeoutMs: number,
): Promise<string> {
  if (!llm.apiKey || llm.api === "anthropic-messages") return "";
  const baseUrl = (llm.baseUrl ?? "https://api.openai.com/v1").replace(/\/+$/, "");
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${llm.apiKey}`,
      ...llm.headers,
    },
    body: JSON.stringify({
      model: llm.modelId,
      temperature: 0.2,
      max_tokens: 40,
      messages: [
        { role: "system", content: TITLE_PROMPT },
        { role: "user", content: prompt.slice(0, 2000) },
      ],
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) return "";
  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return data.choices?.[0]?.message?.content ?? "";
}

export function cleanTitle(raw: string): string {
  const title = raw
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean)
    ?.replace(/^(title\s*:\s*)/i, "")
    .replace(/^["'`*#\s]+|["'`*\s]+$/g, "")
    .replace(/[.!?:;,]+$/, "")
    .trim();
  return title ? truncate(title) : "";
}

export function fallbackTitle(prompt: string): string {
  const firstSentence = prompt.split(/(?<=[.!?])\s|\n/)[0] ?? prompt;
  const title = firstSentence
    .replace(/^(please|pls|can you|could you|would you|hey|hi)[\s,]+/i, "")
    .replace(/[.!?:;,]+$/, "")
    .trim();
  if (!title) return "Untitled session";
  return truncate(title.charAt(0).toUpperCase() + title.slice(1));
}

function truncate(title: string): string {
  if (title.length <= MAX_TITLE_LENGTH) return title;
  const cut = title.slice(0, MAX_TITLE_LENGTH);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 20 ? cut.slice(0, lastSpace) : cut).trim()}…`;
}
