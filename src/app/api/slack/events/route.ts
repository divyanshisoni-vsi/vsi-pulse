import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

/**
 * Slack Events API endpoint.
 *
 * Setup:
 * 1. Create a Slack app at api.slack.com/apps
 * 2. Enable Event Subscriptions → Request URL: https://yourdomain.com/api/slack/events
 * 3. Subscribe to: message.channels (or message.groups for private channels)
 * 4. Add SLACK_SIGNING_SECRET and SLACK_BOT_TOKEN to .env.local
 * 5. Invite the bot to your daily-reports channel
 *
 * Expected message format from employees:
 *   "Today I completed 25 product listings."
 *   "Done: reviewed 12 orders. Quantity: 12"
 */

function verifySlackSignature(req: NextRequest, body: string): boolean {
  const signingSecret = process.env.SLACK_SIGNING_SECRET;
  if (!signingSecret) return false;

  const timestamp = req.headers.get("x-slack-request-timestamp");
  const slackSig = req.headers.get("x-slack-signature");

  if (!timestamp || !slackSig) return false;

  // Reject requests older than 5 minutes
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp)) > 300) return false;

  const baseString = `v0:${timestamp}:${body}`;
  const hmac = crypto
    .createHmac("sha256", signingSecret)
    .update(baseString)
    .digest("hex");
  const computed = `v0=${hmac}`;

  return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(slackSig));
}

function extractQuantity(text: string): number | null {
  // Look for patterns like "25 listings", "quantity: 12", "done 30"
  const patterns = [
    /(?:quantity|units?|completed?|done|reviewed?|processed?)[:\s]+(\d+(?:\.\d+)?)/i,
    /(\d+(?:\.\d+)?)\s+(?:listings?|items?|orders?|tasks?|cases?|products?|reports?|tickets?)/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return parseFloat(match[1]);
  }
  return null;
}

export async function POST(req: NextRequest) {
  const body = await req.text();

  // Verify Slack signature
  if (!verifySlackSignature(req, body)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = JSON.parse(body);

  // Handle Slack URL verification challenge
  if (payload.type === "url_verification") {
    return NextResponse.json({ challenge: payload.challenge });
  }

  if (payload.type !== "event_callback") {
    return NextResponse.json({ ok: true });
  }

  const event = payload.event;

  // Only process user messages (not bot messages)
  if (event.type !== "message" || event.bot_id || event.subtype) {
    return NextResponse.json({ ok: true });
  }

  const slackUserId = event.user;
  const text: string = event.text ?? "";
  const ts: string = event.ts ?? "";
  const channel: string = event.channel ?? "";

  // Look up user by Slack user ID in future; for now match by email via profile lookup
  // For MVP: skip if no match — admin can add logs manually
  // TODO: store slack_user_id on the users table and match here

  const quantity = extractQuantity(text);

  // Create a pending log — admin/manager will verify
  // We create it without a userId for now, flagging it for review
  // A real implementation would fetch the Slack profile to match the user
  await prisma.dailyLog.create({
    data: {
      userId: 1, // Placeholder — will be properly matched once slack_user_id is on users table
      logDate: new Date(),
      activity: text.slice(0, 1000),
      quantity: quantity ?? undefined,
      status: "needs_clarification",
      source: "slack",
      slackMessageTs: ts,
      slackChannel: channel,
      rawSlackText: text,
      notes: "Auto-ingested from Slack. Verify user and quantity.",
    },
  });

  return NextResponse.json({ ok: true });
}
