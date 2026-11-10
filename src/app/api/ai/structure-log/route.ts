import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { checkRateLimit, rateLimitResponse, getClientIp } from "@/lib/rate-limit";

interface StructuredLogResponse {
  structuredActivity: string;
  estimatedUnits: number;
  detectedItems: string[];
  needsMoreDetail: boolean;
  clarificationTip: string;
}

function cleanJsonText(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("```")) {
    return trimmed
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();
  }
  return trimmed;
}

function normalizeAiResult(parsed: any, fallbackText: string): StructuredLogResponse {
  const structuredActivity =
    typeof parsed?.structuredActivity === "string" && parsed.structuredActivity.trim()
      ? parsed.structuredActivity.trim()
      : fallbackText;

  const parsedUnits = Number(parsed?.estimatedUnits);
  const estimatedUnits =
    Number.isFinite(parsedUnits) && parsedUnits >= 0 ? Math.round(parsedUnits) : 0;

  const detectedItems = Array.isArray(parsed?.detectedItems)
    ? parsed.detectedItems
        .filter((item: unknown) => typeof item === "string" && item.trim())
        .slice(0, 5)
    : [];

  const needsMoreDetail = Boolean(parsed?.needsMoreDetail);
  const clarificationTip =
    typeof parsed?.clarificationTip === "string" ? parsed.clarificationTip.trim() : "";

  return {
    structuredActivity,
    estimatedUnits,
    detectedItems,
    needsMoreDetail,
    clarificationTip,
  };
}

function buildPrompt(rawText: string, team?: string, role?: string): string {
  return `You are an enterprise operations assistant at Virtual Solutions India (VSI Pulse).
An employee is submitting their Daily Activity Log. Convert their rough, unstructured notes into a clean, professional, bulleted work summary suitable for manager KPI verification, and extract the total completed deliverable units.

Employee Department: ${team || "General Operations"}
Employee Designation: ${role || "Team Member"}

Raw Activity Notes:
"""
${rawText}
"""

Rules:
1. "structuredActivity": Format the work clearly using concise bullet points starting with "• " (each major deliverable or task on a new line). Keep all facts, batch IDs, ticket numbers, URLs, client names, and quantities completely accurate. Do NOT invent metrics, deliverables, or numbers not stated in the raw notes. Fix spelling/grammar lightly while keeping business context intact.
2. "estimatedUnits": Calculate the integer sum of distinct completed deliverable units/items/listings/orders/cases/bugs/tasks explicitly mentioned (e.g., "18 listings and fixed 4 errors" -> 22; "reviewed 30 orders" -> 30). Do NOT count work hours as deliverable units (e.g., "worked 8 hours" is 0 units unless deliverables are mentioned). If no measurable deliverable count is mentioned, return 0.
3. "detectedItems": A short array of strings summarizing each extracted deliverable item & count (max 4 items, e.g. ["18 listings audited", "4 pricing errors fixed"]). Empty array if none found.
4. "needsMoreDetail": true if no measurable deliverable units or clear output details are present so the employee gets a gentle nudge before submitting; otherwise false.
5. "clarificationTip": If needsMoreDetail is true, provide one short, polite sentence suggesting what to include (e.g., "Consider specifying the number of items completed or adding a reference link."). Otherwise "".

Return ONLY valid JSON with these exact keys:
{
  "structuredActivity": "string",
  "estimatedUnits": number,
  "detectedItems": ["string"],
  "needsMoreDetail": boolean,
  "clarificationTip": "string"
}`;
}

async function callGemini(prompt: string, apiKey: string): Promise<string> {
  const models = [
    "gemini-3.5-flash-lite",
    "gemini-flash-lite-latest",
    "gemini-3.1-flash-lite",
    "gemini-3-flash-preview",
  ];
  let lastError = "Gemini request failed";

  for (const model of models) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: AbortSignal.timeout(8000),
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
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) return text;
      } else {
        const errData = await res.json().catch(() => ({}));
        lastError = errData?.error?.message || `Gemini API error (${res.status})`;
        // Retry fallback model on model deprecation (404/400), transient overload (503/429), or gateway timeout
        if (![400, 404, 429, 500, 502, 503, 504].includes(res.status)) {
          throw new Error(lastError);
        }
      }
    } catch (err: any) {
      lastError = err?.message || `Request failed for ${model}`;
      // Only stop early for auth errors (401/403) rethrown above
      if (lastError.includes("API key not valid") || lastError.includes("PERMISSION_DENIED")) {
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
  model: string
): Promise<string> {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "You are a concise operations assistant returning strictly valid JSON.",
        },
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

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limit: Max 20 AI organize calls per minute per user
    const actor = session.user.email || getClientIp(req);
    const limit = await checkRateLimit(`ai-log:${actor}`, 20, 60);
    if (!limit.success) {
      return rateLimitResponse(
        `AI usage limit reached. Please wait ${limit.retryAfterSeconds}s and try again.`,
        limit
      );
    }

    const body = await req.json();
    const rawText = typeof body?.rawText === "string" ? body.rawText.trim() : "";
    const team = typeof body?.team === "string" ? body.team : undefined;
    const role = typeof body?.role === "string" ? body.role : undefined;

    if (!rawText || rawText.length < 3) {
      return NextResponse.json(
        { error: "Please type a short description of your work before organizing with AI." },
        { status: 400 }
      );
    }

    if (rawText.length > 4000) {
      return NextResponse.json(
        { error: "Activity notes must be under 4,000 characters." },
        { status: 400 }
      );
    }

    const geminiKey = process.env.GEMINI_API_KEY?.trim();
    const groqKey = process.env.GROQ_API_KEY?.trim();
    const openaiKey = process.env.OPENAI_API_KEY?.trim();

    if (!geminiKey && !groqKey && !openaiKey) {
      return NextResponse.json(
        {
          error:
            "AI API key is not configured yet. Please add GEMINI_API_KEY (recommended) in your environment settings.",
          code: "MISSING_AI_KEY",
        },
        { status: 503 }
      );
    }

    const prompt = buildPrompt(rawText, team, role);
    let rawJsonText = "";
    let provider = "gemini";

    if (geminiKey) {
      provider = "gemini";
      rawJsonText = await callGemini(prompt, geminiKey);
    } else if (groqKey) {
      provider = "groq";
      rawJsonText = await callOpenAiCompatible(
        prompt,
        groqKey,
        "https://api.groq.com/openai/v1/chat/completions",
        "llama-3.3-70b-versatile"
      );
    } else if (openaiKey) {
      provider = "openai";
      rawJsonText = await callOpenAiCompatible(
        prompt,
        openaiKey,
        "https://api.openai.com/v1/chat/completions",
        "gpt-4o-mini"
      );
    }

    const parsed = JSON.parse(cleanJsonText(rawJsonText));
    const result = normalizeAiResult(parsed, rawText);

    return NextResponse.json({
      success: true,
      provider,
      ...result,
    });
  } catch (err: any) {
    console.error("POST /api/ai/structure-log error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to structure activity log." },
      { status: 500 }
    );
  }
}
