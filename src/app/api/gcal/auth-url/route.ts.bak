import { NextResponse } from "next/server";
import { google } from "googleapis";

export async function GET(req: Request) {
  try {
    const urlObj = new URL(req.url);
    const orgId = urlObj.searchParams.get("org_id") || "";

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      return NextResponse.json(
        { ok: false, error: "Missing GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REDIRECT_URI" },
        { status: 500 }
      );
    }

    const oauth2 = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

    // Minimal scopes for RenewSentinel: create/manage events + read calendars list
    const scopes = [
      "https://www.googleapis.com/auth/calendar.events",
      "https://www.googleapis.com/auth/calendar.readonly",
    ];

    const authUrl = oauth2.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: scopes,
      state: orgId, // we’ll use this to attach tokens to the right org later
    });

    return NextResponse.json({ ok: true, url: authUrl });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}