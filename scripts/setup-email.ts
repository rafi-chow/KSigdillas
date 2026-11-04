import { randomUUID } from "node:crypto";
import { z } from "zod";
import QRCode from "qrcode";
import { brevoApi, configureBrevoWebhook } from "../src/lib/email/setup";
import { providerSend } from "../src/lib/email/providers";
async function main() {
  const mode = process.argv[2] ?? "check";
  if (mode === "webhook") {
    console.log(JSON.stringify(await configureBrevoWebhook()));
    return;
  }
  const account = z
    .object({
      email: z.email(),
      smtpEnabled: z.boolean().optional(),
      plan: z
        .array(
          z.object({
            type: z.string(),
            credits: z.number().optional(),
            creditsType: z.string().optional(),
          }),
        )
        .optional(),
    })
    .parse(await brevoApi("/account"));
  const senders = z
    .object({
      senders: z
        .array(z.object({ email: z.email(), active: z.boolean() }))
        .default([]),
    })
    .parse(await brevoApi("/senders"));
  const verified = senders.senders.some(
    (s) =>
      s.email.toLowerCase() === process.env.EMAIL_FROM?.toLowerCase() &&
      s.active,
  );
  if (mode === "check") {
    console.log(
      JSON.stringify({
        accountReachable: true,
        smtpEnabled: account.smtpEnabled ?? null,
        configuredSenderActive: verified,
        plan: account.plan?.map(({ type, credits, creditsType }) => ({
          type,
          credits,
          creditsType,
        })),
      }),
    );
    return;
  }
  if (mode !== "test") throw new Error("Use check | test | webhook.");
  if (!verified)
    throw new Error("Verify the configured sender in Brevo before sending.");
  const recipient = z.email().parse(process.env.EMAIL_TEST_TO);
  if (recipient.toLowerCase() !== account.email.toLowerCase())
    throw new Error(
      "Setup test is limited to the signed-in account's own inbox.",
    );
  const content = (
    await QRCode.toBuffer("KSIGDILLAS-DELIVERY-TEST-NOT-VALID", {
      width: 320,
      margin: 3,
    })
  ).toString("base64");
  const id = await providerSend(
    {
      to: recipient,
      subject: "[TEST] KSigdillas ticket delivery — not an admission ticket",
      html: "<html><body><h1>KSigdillas delivery test</h1><p>This is a setup test sent to your own account. The attached QR is intentionally invalid for admission.</p><p>Please check the sender, reply-to, attachment and spam folder. Reply to the development chat when received.</p></body></html>",
      text: "KSigdillas delivery setup test. The attached QR is NOT valid for admission. Check the sender, reply-to, attachment and spam folder; confirm receipt in the development chat.",
      attachments: [
        {
          filename: "delivery-test-NOT-A-TICKET.png",
          content,
          content_id: "delivery-test",
        },
      ],
    },
    `setup-${randomUUID()}`,
  );
  console.log(
    JSON.stringify({
      providerAccepted: true,
      providerReference: id,
      inboxDeliveryConfirmed: false,
    }),
  );
}
void main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Email setup failed.");
  process.exitCode = 1;
});
