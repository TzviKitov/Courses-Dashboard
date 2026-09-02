/**
 * Global SMS SOAP sender (sapi.itnewsletter.co.il).
 * Used by the student Auth SMS hook and instructor MFA OTP.
 */

const GLOBAL_SMS_SOAP_URL =
  "https://sapi.itnewsletter.co.il/webservices/wssms.asmx";

const GLOBAL_SMS_FAILURES = [
  "invalid login",
  "empty message",
  "unapporved originator number",
  "unapproved originator number",
  "no valid mobile numbers",
  "not enough credit in your account",
  "system error",
  "e 1",
  "originator length is 0",
  "originator length is greater than 11",
  "wrong date format",
  "len(txtaddinf)",
];

function shortAddInf(prefix = "otp"): string {
  const suffix = Date.now().toString(36);
  return `${prefix}${suffix}`.slice(0, 15);
}

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
      /<(?:\w+:)?sendSmsToRecipientsResult[^>]*>([\s\S]*?)<\/(?:\w+:)?sendSmsToRecipientsResult>/i
    ) || xml.match(/<(?:\w+:)?sendSmsToRecipientsResult[^>]*\/>/i);
  if (!match) return "";
  if (match[1] === undefined) return "";
  return match[1]
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&amp;/g, "&")
    .trim();
}

function parseCreditsCharged(result: string): number | null {
  if (!/^\d+(\.\d+)?$/.test(result)) return null;
  const n = Number(result);
  return Number.isFinite(n) ? n : null;
}

export function isProductionRuntime(): boolean {
  return (
    process.env.VERCEL_ENV === "production" ||
    process.env.NODE_ENV === "production"
  );
}

export async function sendIsraeliSms(opts: {
  localPhone: string;
  message: string;
}): Promise<{ ok: boolean; error?: string; devLogged?: boolean }> {
  const providerUrl =
    process.env.SMS_PROVIDER_URL?.trim() || GLOBAL_SMS_SOAP_URL;
  const apiKey = process.env.SMS_PROVIDER_TOKEN?.trim();
  const originator = process.env.SMS_ORIGINATOR?.trim();

  if (!apiKey) {
    if (isProductionRuntime()) {
      return { ok: false, error: "SMS provider not configured" };
    }
    console.info(`[sms] DEV skip send to ${opts.localPhone}`);
    return { ok: true, devLogged: true };
  }

  if (!originator) {
    return { ok: false, error: "SMS originator not configured" };
  }

  const soapBody = buildSendSmsSoapEnvelope({
    apiKey,
    originator,
    destinations: opts.localPhone,
    message: opts.message,
    addInf: shortAddInf(),
  });

  try {
    const res = await fetch(providerUrl, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
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
        "[sms] Global SMS failed:",
        res.status,
        "result=",
        result.slice(0, 200) || "(empty)"
      );
      return { ok: false, error: "SMS send failed" };
    }
    return { ok: true };
  } catch (e) {
    console.error("[sms] provider error:", e);
    return { ok: false, error: "SMS send failed" };
  }
}
