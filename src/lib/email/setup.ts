import { z } from "zod";
export type ServiceFetch = typeof fetch;
export async function brevoApi(
  path: string,
  init: RequestInit = {},
  send: ServiceFetch = fetch,
) {
  const key = process.env.BREVO_API_KEY;
  if (!key) throw new Error("Configure the Brevo key securely.");
  if (!/^\/(account|senders|webhooks)(\/\d+)?$/.test(path))
    throw new Error("Unsupported setup endpoint.");
  const response = await send(`https://api.brevo.com/v3${path}`, {
    ...init,
    redirect: "error",
    headers: { "api-key": key, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok)
    throw new Error(`Brevo setup request failed (HTTP ${response.status}).`);
  return response.status === 204 ? {} : await response.json();
}
export function emailWebhookConfig(origin: string, secret: string) {
  const url = new URL(origin);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    !/^[A-Za-z0-9_-]{32,}$/.test(secret)
  )
    throw new Error("Use HTTPS and a strong webhook secret.");
  return {
    description: "KSigdillas transactional ticket delivery",
    url: new URL("/api/email/webhook", url.origin).href,
    type: "transactional",
    events: [
      "request",
      "delivered",
      "hardBounce",
      "softBounce",
      "blocked",
      "invalid",
      "deferred",
      "spam",
    ],
    headers: [{ key: "x-ksigdillas-webhook-secret", value: secret }],
  };
}
export async function configureBrevoWebhook(send: ServiceFetch = fetch) {
  const config = emailWebhookConfig(
    process.env.APP_URL ?? "",
    process.env.EMAIL_WEBHOOK_SECRET ?? "",
  );
  const listed = z
    .object({
      webhooks: z
        .array(
          z.object({
            id: z.number(),
            url: z.string(),
            description: z.string().optional(),
          }),
        )
        .default([]),
    })
    .parse(await brevoApi("/webhooks", {}, send));
  const matches = listed.webhooks.filter(
    (w) => w.description === config.description,
  );
  if (matches.length > 1)
    throw new Error("Review duplicate KSigdillas webhooks before setup.");
  const existing = matches[0];
  const result = await brevoApi(
    existing ? `/webhooks/${existing.id}` : "/webhooks",
    { method: existing ? "PUT" : "POST", body: JSON.stringify(config) },
    send,
  );
  return {
    configured: true,
    updated: Boolean(existing),
    id: existing?.id ?? z.object({ id: z.number() }).parse(result).id,
  };
}
