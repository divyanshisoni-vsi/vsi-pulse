export function cleanEnvKey(value?: string): string {
  if (!value) return "";
  return value
    .replace(/\\r|\\n/g, "")
    .trim()
    .replace(/^['"`]+|['"`]+$/g, "")
    .replace(
      /^(?:GEMINI_API_KEY|GOOGLE_GENERATIVE_AI_API_KEY|GOOGLE_API_KEY|OPENAI_API_KEY|GROQ_API_KEY)\s*=\s*/i,
      ""
    )
    .replace(/^Bearer\s+/i, "")
    .trim()
    .replace(/^['"`]+|['"`]+$/g, "")
    .replace(/\s+/g, "");
}

export function resolveGeminiEnvKey(): { key: string; source: string } {
  const candidates: Array<[string, string | undefined]> = [
    ["GEMINI_API_KEY", process.env.GEMINI_API_KEY],
    ["GOOGLE_GENERATIVE_AI_API_KEY", process.env.GOOGLE_GENERATIVE_AI_API_KEY],
    ["GOOGLE_API_KEY", process.env.GOOGLE_API_KEY],
  ];
  for (const [source, raw] of candidates) {
    const cleaned = cleanEnvKey(raw);
    if (cleaned) return { key: cleaned, source };
  }
  return { key: "", source: "GEMINI_API_KEY" };
}

function describeKeyFormat(key: string): string {
  const prefix = key.startsWith("AQ.")
    ? "AQ.*"
    : key.startsWith("AIza")
      ? "AIza*"
      : "unexpected prefix";
  return `length ${key.length}, ${prefix}`;
}

export function cleanJsonText(raw: string): string {
  let trimmed = raw.trim();
  if (trimmed.startsWith("```")) {
    trimmed = trimmed
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();
  }
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }
  return trimmed;
}

async function callGemini(
  prompt: string,
  apiKey: string,
  keySource: string,
  timeoutBudgetMs = 8000
): Promise<string> {
  const models = [
    "gemini-flash-lite-latest",
    "gemini-3.5-flash-lite",
    "gemini-3.1-flash-lite",
  ];
  const deadline = Date.now() + timeoutBudgetMs;
  let lastError = "Gemini request failed";

  for (const model of models) {
    const remainingMs = deadline - Date.now();
    if (remainingMs < 1200) break;

    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          signal: AbortSignal.timeout(Math.min(5500, remainingMs)),
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.2,
              responseMimeType: "application/json",
            },
          }),
        }
      );

      if (res.ok) {
        const data = await res.json();
        const parts = data?.candidates?.[0]?.content?.parts;
        const text = Array.isArray(parts)
          ? parts
              .filter((p: any) => p && !p.thought && typeof p.text === "string")
              .map((p: any) => p.text)
              .join("")
              .trim()
          : "";
        if (text) return text;
        lastError = "Gemini returned an empty response.";
      } else {
        const errData = await res.json().catch(() => ({}));
        const rawMsg = errData?.error?.message || `Gemini API error (${res.status})`;
        const isCredentialError =
          rawMsg.includes("API key not valid") ||
          rawMsg.includes("API_KEY_INVALID") ||
          rawMsg.includes("PERMISSION_DENIED");
        if (isCredentialError) {
          throw new Error(
            `${rawMsg} (server ${keySource}: ${describeKeyFormat(apiKey)} — update GEMINI_API_KEY in Vercel Environment Variables and Redeploy).`
          );
        }
        lastError = rawMsg;
        if (![400, 404, 429, 500, 502, 503, 504].includes(res.status)) {
          throw new Error(lastError);
        }
      }
    } catch (err: any) {
      lastError = err?.message || `Request failed for ${model}`;
      if (
        lastError.includes("API key not valid") ||
        lastError.includes("API_KEY_INVALID") ||
        lastError.includes("PERMISSION_DENIED")
      ) {
        throw new Error(lastError);
      }
    }
  }

  throw new Error(lastError);
}

async function callOpenAiCompatible(
  prompt: string,
  apiKey: string,
  endpoint: string,
  model: string,
  systemInstruction: string
): Promise<string> {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    signal: AbortSignal.timeout(8500),
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemInstruction },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData?.error?.message || `AI provider error (${res.status})`);
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error("Empty response from AI provider.");
  return text;
}

export class MissingAiKeyError extends Error {
  constructor() {
    super(
      "AI API key is not configured on this server. Add GEMINI_API_KEY in Vercel Environment Variables and redeploy."
    );
    this.name = "MissingAiKeyError";
  }
}

export async function generateAiJson<T = any>(params: {
  prompt: string;
  systemInstruction?: string;
  timeoutBudgetMs?: number;
}): Promise<{ provider: "gemini" | "groq" | "openai"; parsed: T }> {
  const { key: geminiKey, source: geminiSource } = resolveGeminiEnvKey();
  const groqKey = cleanEnvKey(process.env.GROQ_API_KEY);
  const openaiKey = cleanEnvKey(process.env.OPENAI_API_KEY);

  if (!geminiKey && !groqKey && !openaiKey) {
    throw new MissingAiKeyError();
  }

  const systemInstruction =
    params.systemInstruction ||
    "You are a concise enterprise operations assistant returning strictly valid JSON.";

  let rawJsonText = "";
  let provider: "gemini" | "groq" | "openai" = "gemini";

  if (geminiKey) {
    provider = "gemini";
    rawJsonText = await callGemini(
      params.prompt,
      geminiKey,
      geminiSource,
      params.timeoutBudgetMs ?? 8000
    );
  } else if (groqKey) {
    provider = "groq";
    rawJsonText = await callOpenAiCompatible(
      params.prompt,
      groqKey,
      "https://api.groq.com/openai/v1/chat/completions",
      "llama-3.3-70b-versatile",
      systemInstruction
    );
  } else if (openaiKey) {
    provider = "openai";
    rawJsonText = await callOpenAiCompatible(
      params.prompt,
      openaiKey,
      "https://api.openai.com/v1/chat/completions",
      "gpt-4o-mini",
      systemInstruction
    );
  }

  const parsed = JSON.parse(cleanJsonText(rawJsonText)) as T;
  return { provider, parsed };
}
