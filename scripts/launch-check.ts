import { launchChecks } from "../src/lib/launch";
import {
  checkoutAvailable,
  stripeRuntimeAvailable,
  stripeRefundWriteEnabled,
} from "../src/lib/payments/stripe";
const checks = launchChecks();
console.log(
  JSON.stringify(
    {
      checks,
      stripeConfigured: stripeRuntimeAvailable(),
      salesAvailable: checkoutAvailable(),
      refundWrites: stripeRefundWriteEnabled(),
      note: "Recorded evidence does not substitute for real provider, physical-device or organizer acceptance.",
    },
    null,
    2,
  ),
);
if (checks.some((c) => !c.ready) || !stripeRuntimeAvailable())
  process.exitCode = 2;
