import { digest } from "../operations/crypto";
import { eventConfig } from "../eventConfig";
import type { ticketEmail } from "./delivery";
export class DeliveryError extends Error {
  constructor(
    public uncertain: boolean,
    public retryAfterSeconds = 60,
  ) {
    super(
      uncertain
        ? "Delivery outcome is uncertain; inspect provider logs before resending."
        : "Delivery was rejected; retry after checking provider status.",
    );
  }
}
type Message = Awaited<ReturnType<typeof ticketEmail>>;
export function emailProvider() {
  const name = process.env.EMAIL_PROVIDER ?? "resend";
  if (name !== "brevo" && name !== "resend")
    throw new Error("Choose Brevo or Resend for email delivery.");
  return name;
}
export function deliveryLimit() {
  const provider = emailProvider();
  const maximum = provider === "brevo" ? 300 : 100;
  const configured = Number(process.env.EMAIL_DAILY_LIMIT ?? maximum);
  if (!Number.isInteger(configured) || configured < 1 || configured > maximum)
    throw new Error("Invalid free email daily limit.");
  return configured;
}
export function brevoPayload(message: Message, key: string) {
  const email = process.env.EMAIL_FROM ?? "";
  if (!/^[^<>\s@]+@[^<>\s@]+\.[^<>\s@]+$/.test(email))
    throw new Error("Brevo requires a verified EMAIL_FROM address.");
  const hash = digest(key);
  const uuid = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
  // Brevo's attachment API does not expose Resend's content_id. Retain secure
  // inline ticket links and attach the QR PNGs without broken cid image tags.
  return {
    sender: { email, name: "KSigdillas Tickets" },
    // This requests anonymized reporting, not removal of Brevo's open pixel.
    // The account's anonymous tracking setting also covers click reporting.
    to: [{ email: message.to, contactPixelTrackingConsent: false }],
    replyTo: { email: eventConfig.contactEmail, name: "KSigdillas support" },
    subject: message.subject,
    htmlContent: message.html.replace(
      /<img src="cid:[^"]+"[^>]*\/>/g,
      "<p>Your QR is attached. You can also open your ticket below.</p>",
    ),
    textContent: message.text,
    attachment: message.attachments.map((a) => ({
      content: a.content,
      name: a.filename,
    })),
    headers: { idempotencyKey: uuid },
    tags: ["ksigdillas-ticket"],
  };
}
export async function providerSend(
  message: Message,
  key: string,
  signal: AbortSignal = AbortSignal.timeout(15000),
): Promise<string> {
  const provider = emailProvider();
  const credential =
    provider === "brevo"
      ? process.env.BREVO_API_KEY
      : process.env.RESEND_API_KEY;
  if (!credential || !process.env.EMAIL_FROM)
    throw new Error("Email delivery is not configured.");
  const body =
    provider === "brevo"
      ? brevoPayload(message, key)
      : {
          ...message,
          from: process.env.EMAIL_FROM,
          reply_to: eventConfig.contactEmail,
        };
  let response: Response;
  try {
    response = await fetch(
      provider === "brevo"
        ? "https://api.brevo.com/v3/smtp/email"
        : "https://api.resend.com/emails",
      {
        method: "POST",
        headers:
          provider === "brevo"
            ? { "api-key": credential, "Content-Type": "application/json" }
            : {
                Authorization: `Bearer ${credential}`,
                "Content-Type": "application/json",
                "Idempotency-Key": key,
              },
        body: JSON.stringify(body),
        signal,
      },
    );
  } catch {
    throw new DeliveryError(true);
  }
  if (!response.ok)
    throw new DeliveryError(
      response.status >= 500 ||
        (provider === "brevo" && response.status === 400),
      response.status === 429 ? 3600 : 60,
    );
  let data;
  try {
    data = await response.json();
  } catch {
    throw new DeliveryError(true);
  }
  const id = provider === "brevo" ? data.messageId : data.id;
  if (typeof id !== "string" || !id) throw new DeliveryError(true);
  return id;
}
