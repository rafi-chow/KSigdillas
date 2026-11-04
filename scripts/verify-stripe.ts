import { randomUUID } from "node:crypto";
import { writeFile, mkdir } from "node:fs/promises";
import { checkoutConfig, stripeGateway } from "../src/lib/payments/stripe";
import { appUrl } from "../src/lib/email/delivery";
async function main() {
  if (!process.argv.includes("--unpaid-session"))
    throw new Error(
      "Use --unpaid-session for an unshared checkout that is immediately expired. No charge or customer is created.",
    );
  const config = checkoutConfig();
  const gateway = stripeGateway();
  const probe = randomUUID();
  let sessionId: string | undefined;
  try {
    const session = await gateway.create(
      {
        mode: "payment",
        ui_mode: "embedded_page",
        allowed_payment_method_types: ["card"],
        line_items: [{ price: config.prices.basic, quantity: 1 }],
        client_reference_id: `setup-${probe}`,
        metadata: {
          ksigdillas_setup: "unpaid-configuration-check",
          catalog: JSON.stringify({
            [config.prices.basic]: {
              quantity: 1,
              cents: config.pricingMode === "all_in" ? 1061 : 1000,
            },
          }),
        },
        return_url: `${appUrl()}/checkout?setup=1`,
        redirect_on_completion: "always",
        expires_at: Math.floor(Date.now() / 1000) + 31 * 60,
      },
      `ksigdillas-setup-${probe}`,
    );
    sessionId = session.id;
    if (
      session.status !== "open" ||
      session.payment_status === "paid" ||
      session.livemode !== config.livemode
    )
      throw new Error("Unexpected setup session state.");
    const expired = await gateway.expire(session.id);
    if (expired.status !== "expired" || expired.payment_status === "paid")
      throw new Error("Setup session expiration needs review.");
    await mkdir(".data/deployment", { recursive: true });
    await writeFile(
      ".data/deployment/stripe-unpaid-session-verification.json",
      JSON.stringify({
        at: new Date().toISOString(),
        sessionId,
        mode: config.livemode ? "live" : "test",
        created: true,
        expired: true,
        charged: false,
        clientSecretExposed: false,
      }),
      { mode: 0o600 },
    );
    sessionId = undefined;
    console.log(
      JSON.stringify({
        checkoutCreationVerified: true,
        restrictedKey: config.secret.startsWith("rk_"),
        expired: true,
        charged: false,
      }),
    );
  } finally {
    if (sessionId) await gateway.expire(sessionId).catch(() => undefined);
  }
}
void main().catch((error) => {
  console.error(
    `Unpaid Stripe configuration check failed (${typeof error?.statusCode === "number" ? `HTTP ${error.statusCode}` : "validation"}); no credential or checkout secret printed.`,
  );
  process.exitCode = 1;
});
