import { purchaseTerms } from "../policies";
import QRCode from "qrcode";
import { unseal } from "../operations/crypto";
import type { Job, State } from "../operations/model";
import type { Store } from "../operations/store";
import { eventConfig } from "../eventConfig";
import { audit } from "../operations/service";
import { randomUUID } from "node:crypto";
import {
  DeliveryError,
  deliveryLimit,
  emailProvider,
  providerSend,
} from "./providers";
import { applyEmailEvents } from "./events";
import { withinBudget } from "../jobs/budget";
const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function appUrl() {
  const configured = process.env.APP_URL;
  if (!configured) throw new Error("Ticket links are not configured.");
  const url = new URL(configured);
  if (
    url.protocol !== "https:" &&
    !(
      process.env.NODE_ENV !== "production" &&
      ["localhost", "127.0.0.1"].includes(url.hostname)
    )
  )
    throw new Error("Ticket links require HTTPS.");
  return url.origin;
}
export async function ticketEmail(s: State, job: Job) {
  const order = s.orders.find((o) => o.id === job.orderId);
  if (
    !order ||
    order.privacyAnonymizedAt ||
    !["paid", "partially-refunded"].includes(order.status)
  )
    throw new Error("Order is not eligible for ticket delivery.");
  const origin = appUrl();
  const tickets = s.tickets.filter((t) => t.orderId === order.id && t.valid);
  if (!tickets.length) throw new Error("No valid tickets remain.");
  const attachments = [];
  const cards = [];
  for (const t of tickets) {
    const link = `${origin}/tickets/${unseal(t.tokenBox)}`;
    const cid = `ticket-${t.id}`;
    attachments.push({
      filename: `${t.id}.png`,
      content: (
        await QRCode.toBuffer(link, { width: 320, margin: 3 })
      ).toString("base64"),
      content_id: cid,
    });
    cards.push(
      `<section style="padding:20px;border:1px solid #ddd;margin:16px 0"><h2>${escape(t.name)} · ${t.tier === "basic" ? "Basicdilla" : "Meat/Veggie Pass"}</h2><p>${escape(t.teamId?.toUpperCase() ?? "No team")}</p><img src="cid:${cid}" width="240" height="240" alt="Admission QR code"/><p><a href="${link}">Open your ticket</a></p><p>Reference: ${escape(t.id)}</p></section>`,
    );
  }
  return {
    to: order.email,
    subject: "Your KSigdillas tickets · November 19",
    html: `<html><body style="font-family:Arial,sans-serif;max-width:620px;margin:auto;padding:24px"><h1>You're coming to KSigdillas.</h1><p>Thursday, November 19, 2026 · 6–9 PM Central<br/>707 S Davis Dr backyard, Arlington</p><p>Show one QR per person at the door. Your wristband matches your food tier.</p>${cards.join("")}<p>${escape(purchaseTerms.refund)} <a href="${origin}/terms">Ticket terms</a> · <a href="${origin}/privacy">Privacy</a>. Questions? <a href="mailto:${eventConfig.contactEmail}">${eventConfig.contactEmail}</a></p></body></html>`,
    text: `KSigdillas · November 19, 2026 · 6–9 PM Central · 707 S Davis Dr backyard. ${tickets.map((t) => `${t.name}: ${origin}/tickets/${unseal(t.tokenBox)} (reference ${t.id})`).join("\n")} ${purchaseTerms.refund} Terms: ${origin}/terms Privacy: ${origin}/privacy Contact: ${eventConfig.contactEmail}`,
    attachments,
  };
}
export type Delivery = (
  message: Awaited<ReturnType<typeof ticketEmail>>,
  key: string,
  signal?: AbortSignal,
) => Promise<string>;
export const sendEmail: Delivery = providerSend;
export async function deliverDue(
  store: Store,
  delivery: Delivery = sendEmail,
  now = new Date(),
  options: { deadline?: number; limit?: number } = {},
) {
  const deadline = options.deadline ?? Date.now() + 60000;
  await store.transaction((s) => {
    for (const job of s.jobs.filter(
      (j) =>
        j.status === "sending" &&
        j.leaseUntil &&
        Date.parse(j.leaseUntil) <= now.getTime(),
    )) {
      job.status = "failed";
      // Legacy sending rows have no phase marker: treat them as ambiguous.
      job.uncertain = job.sendStarted !== false;
      job.lastError =
        "Worker stopped during delivery. Inspect provider logs before retrying.";
      job.leaseUntil = undefined;
    }
    applyEmailEvents(s);
  });
  const result = { sent: 0, failed: 0 };
  // Claim immediately before each send. An interrupted worker must never hold
  // a batch of unstarted messages in the ambiguous-delivery state.
  for (
    let i = 0;
    i < (options.limit ?? 3) && Date.now() < deadline - 1000;
    i++
  ) {
    const j = await store.transaction((s) => {
      if (Date.now() >= deadline - 1000) return null;
      const provider = emailProvider();
      // Rolling 24-hour reservation count is conservative across provider reset
      // time zones and includes uncertain sends and concurrent workers.
      const cutoff = now.getTime() - 86400000;
      const used = s.audit.filter(
        (a) =>
          a.action === "email-quota-reserved" &&
          a.reason === provider &&
          Date.parse(a.createdAt) > cutoff,
      ).length;
      const remaining =
        delivery === sendEmail ? Math.max(0, deliveryLimit() - used) : 10;
      const job = s.jobs
        .filter(
          (j) =>
            j.status !== "sent" &&
            !j.uncertain &&
            j.attempts < 8 &&
            Date.parse(j.nextAttemptAt) <= now.getTime() &&
            (!j.leaseUntil || Date.parse(j.leaseUntil) <= now.getTime()),
        )
        .sort((a, b) => a.nextAttemptAt.localeCompare(b.nextAttemptAt))[0];
      if (!job || remaining <= 0) return null;
      const j = job;
      j.status = "sending";
      j.sendStarted = false;
      j.leaseId = randomUUID();
      j.provider = provider;
      j.attempts++;
      j.leaseUntil = new Date(now.getTime() + 120000).toISOString();
      if (delivery === sendEmail)
        audit(s, "email-worker", "email-quota-reserved", j.id, provider, now);
      return structuredClone(j);
    });
    if (!j) break;
    let providerAccepted = false;
    try {
      const message = await ticketEmail(await store.read(), j);
      const sendDeadline = Math.min(deadline, Date.now() + 15000);
      let providerRef: string;
      const maySend = await store.transaction((s) => {
        const row = s.jobs.find((x) => x.id === j.id)!;
        if (row.leaseId !== j.leaseId || Date.now() >= sendDeadline)
          return false;
        row.sendStarted = true;
        return true;
      });
      if (!maySend) throw new DeliveryError(false);
      try {
        providerRef = await withinBudget(
          () =>
            delivery(
              message,
              `ksigdillas-${j.id}`,
              AbortSignal.timeout(Math.max(1, sendDeadline - Date.now())),
            ),
          sendDeadline,
        );
      } catch (error) {
        // A deadline/transport failure after starting the request may have
        // been accepted by the provider. Never automatically duplicate it.
        throw error instanceof DeliveryError ? error : new DeliveryError(true);
      }
      providerAccepted = true;
      await store.transaction((s) => {
        const row = s.jobs.find((x) => x.id === j.id)!;
        if (row.leaseId !== j.leaseId) return;
        row.status = "sent";
        row.sentAt = now.toISOString();
        row.providerRef = providerRef;
        row.deliveryStatus = "accepted";
        row.leaseUntil = undefined;
        audit(
          s,
          "email-worker",
          "email-sent",
          j.orderId,
          "Ticket email sent",
          now,
        );
      });
      result.sent++;
    } catch (error) {
      await store.transaction((s) => {
        const row = s.jobs.find((x) => x.id === j.id)!;
        if (row.leaseId !== j.leaseId) return;
        row.status = "failed";
        row.lastError =
          error instanceof DeliveryError
            ? error.message
            : "Ticket delivery failed; inspect provider configuration or retry.";
        row.uncertain =
          providerAccepted ||
          (error instanceof DeliveryError && error.uncertain);
        row.nextAttemptAt = new Date(
          now.getTime() +
            (error instanceof DeliveryError
              ? error.retryAfterSeconds * 1000
              : Math.min(3600000, 30000 * 2 ** row.attempts)),
        ).toISOString();
        row.leaseUntil = undefined;
      });
      result.failed++;
    }
  }
  if (Date.now() < deadline)
    await store.transaction((s) => applyEmailEvents(s));
  return result;
}
