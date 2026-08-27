import { NextResponse } from "next/server";
import { Webhook } from "standardwebhooks";
import {
  normalizeIsraeliPhone,
  toIsraeliLocalPhone,
} from "@/lib/auth/phone";

/**
 * Global SMS "sapi" SOAP endpoint — HTTPS web service that does not require
 * outbound IP whitelist (unlike api.itnewsletter.co.il REST).
 * Confirmed by Global SMS support for Vercel / dynamic-IP hosts.
 */
const GLOBAL_SMS_SOAP_URL =
  "https://sapi.itnewsletter.co.il/webservices/wssms.asmx";

const GLOBAL_SMS_FAILURES = [
  "invalid login",
  "empty message",
  "unapporved originator number", // spelling from Global SMS docs
  "unapproved originator number",
  "no valid mobile numbers",
  "not enough credit in your account",
  "system error",
  "e 1",
  "originator length is 0",
  "originator length is greater than 11",
  "wrong date format",
];

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildSendSmsSoapEnvelope(opts: {
  apiKey: string;
  originator: string;
  destinations: string;
  message: string;
  addInf: string;
}): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <sendSmsToRecipients xmlns="apiGlobalSms">
      <ApiKey>${escapeXml(opts.apiKey)}</ApiKey>
      <txtOriginator>${escapeXml(opts.originator)}</txtOriginator>
      <destinations>${escapeXml(opts.destinations)}</destinations>
      <txtSMSmessage>${escapeXml(opts.message)}</txtSMSmessage>
      <dteToDeliver></dteToDeliver>
      <txtAddInf>${escapeXml(opts.addInf)}</txtAddInf>
    </sendSmsToRecipients>
  </soap:Body>
</soap:Envelope>`;
}

function extractSoapResult(xml: string): string {
  const match =
    xml.match(
      /<sendSmsToRecipientsResult[^>]*>([\s\S]*?)<\/sendSmsToRecipientsResult>/i
    ) || xml.match(/<sendSmsToRecipientsResult[^>]*\/>/i);
  if (!match) return "";
  if (match[1] === undefined) return "";
  return match[1]
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .trim();
}

/** Success = credits charged (numeric string from Global SMS). */
function parseCreditsCharged(result: string): number | null {
  if (!/^\d+(\.\d+)?$/.test(result)) return null;
  const n = Number(result);
  return Number.isFinite(n) ? n : null;
}

function isProductionRuntime(): boolean {
  return (
    process.env.VERCEL_ENV === "production" ||
    process.env.NODE_ENV === "production"
  );
}

/** Supabase stores secrets as `v1,whsec_...` — Standard Webhooks needs the base64 part. */
function hookSecretKey(raw: string): string {
  return raw
    .trim()
    .replace(/^v1,/, "")
    .replace(/^whsec_/, "");
}

/**
 * Supabase Auth Hook: Send SMS via Global SMS SOAP (sapi).
 *
 * Auth uses Standard Webhooks (not Bearer). In Supabase Hook settings use
 * "Generate secret", then set the same value (including `v1,whsec_` prefix)
 * as SMS_HOOK_SECRET in Vercel / .env.local.
 */
export async function POST(req: Request) {
  const secret = process.env.SMS_HOOK_SECRET?.trim();
  const rawBody = await req.text();

  let payload: {
    user?: { phone?: string };
    sms?: { otp?: string };
  };

  if (secret) {
    try {
      const wh = new Webhook(hookSecretKey(secret));
      const headers = Object.fromEntries(req.headers.entries());
      payload = wh.verify(rawBody, headers) as typeof payload;
    } catch (e) {
      console.error("[sms-hook] webhook verify failed:", e);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else if (isProductionRuntime()) {
    console.error("[sms-hook] SMS_HOOK_SECRET missing in production");
    return NextResponse.json(
      { error: "SMS hook not configured" },
      { status: 500 }
    );
  } else {
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
  }

  const phoneRaw = payload.user?.phone || "";
  const otp = payload.sms?.otp || "";
  const phoneE164 = normalizeIsraeliPhone(phoneRaw);
  const phoneLocal = phoneE164 ? toIsraeliLocalPhone(phoneE164) : null;

  if (!otp || !phoneLocal) {
    return NextResponse.json(
      { error: "Missing phone/otp or invalid Israeli mobile" },
      { status: 400 }
    );
  }

  if (process.env.SMS_ISRAEL_ONLY !== "false" && !phoneE164) {
    console.warn("[sms-hook] Rejected non-IL phone:", phoneRaw);
    return NextResponse.json({ error: "Israel numbers only" }, { status: 400 });
  }

  const message = `קוד האימות שלך: ${otp}`;
  const providerUrl =
    process.env.SMS_PROVIDER_URL?.trim() || GLOBAL_SMS_SOAP_URL;
  const apiKey = process.env.SMS_PROVIDER_TOKEN?.trim();
  const originator = process.env.SMS_ORIGINATOR?.trim();

  if (!apiKey) {
    if (isProductionRuntime()) {
      console.error(
        "[sms-hook] SMS_PROVIDER_TOKEN missing — refusing silent OTP success"
      );
      return NextResponse.json(
        { error: "SMS provider not configured" },
        { status: 500 }
      );
    }
    console.info(`[sms-hook] DEV OTP for ${phoneLocal}: ${otp}`);
    return NextResponse.json({});
  }

  if (!originator) {
    console.error("[sms-hook] SMS_ORIGINATOR is required for Global SMS");
    return NextResponse.json(
      { error: "SMS originator not configured" },
      { status: 500 }
    );
  }

  const soapBody = buildSendSmsSoapEnvelope({
    apiKey,
    originator,
    destinations: phoneLocal,
    message,
    addInf: `otp_${Date.now()}`,
  });

  try {
    const res = await fetch(providerUrl, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        // ASMX expects quoted SOAPAction value
        SOAPAction: '"apiGlobalSms/sendSmsToRecipients"',
      },
      body: soapBody,
    });

    const responseText = (await res.text()).trim();
    const result = extractSoapResult(responseText);
    const lower = result.toLowerCase();
    const credits = parseCreditsCharged(result);
    const lookedLikeFailure =
      !res.ok ||
      credits === null ||
      credits <= 0 ||
      GLOBAL_SMS_FAILURES.some((f) => lower.includes(f.toLowerCase())) ||
      /faultstring/i.test(responseText);

    if (lookedLikeFailure) {
      console.error(
        "[sms-hook] Global SMS failed:",
        res.status,
        "result=",
        result.slice(0, 200) || "(empty)",
        "body=",
        responseText.slice(0, 400)
      );
      return NextResponse.json({ error: "SMS send failed" }, { status: 502 });
    }

    console.info(
      "[sms-hook] Global SMS charged",
      credits,
      "for",
      phoneLocal
    );
  } catch (e) {
    console.error("[sms-hook] provider error:", e);
    return NextResponse.json({ error: "SMS send failed" }, { status: 502 });
  }

  return NextResponse.json({});
}
