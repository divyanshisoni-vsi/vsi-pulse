import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { checkRateLimit, rateLimitResponse, getClientIp } from "@/lib/rate-limit";
import { generateAiJson, MissingAiKeyError } from "@/lib/ai-provider";

export const maxDuration = 30;

interface StructuredLogResponse {
  structuredActivity: string;
  estimatedUnits: number;
  detectedItems: string[];
  needsMoreDetail: boolean;
  clarificationTip: string;
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

    const { provider, parsed } = await generateAiJson({
      prompt: buildPrompt(rawText, team, role),
      timeoutBudgetMs: 8000,
    });

    const result = normalizeAiResult(parsed, rawText);

    return NextResponse.json({
      success: true,
      provider,
      ...result,
    });
  } catch (err: any) {
    if (err instanceof MissingAiKeyError) {
      return NextResponse.json(
        {
          error: err.message,
          code: "MISSING_AI_KEY",
        },
        { status: 503 }
      );
    }
    console.error("POST /api/ai/structure-log error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to structure activity log." },
      { status: 500 }
    );
  }
}
