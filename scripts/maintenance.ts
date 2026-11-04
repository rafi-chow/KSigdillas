// One-shot scheduler client. Credentials are supplied in the process environment,
// never implicitly loaded from .env.local or embedded in a URL.
async function main() {
  const origin = new URL(process.env.APP_URL ?? "");
  if (
    origin.protocol !== "https:" &&
    !["127.0.0.1", "localhost"].includes(origin.hostname)
  )
    throw new Error("Maintenance target requires HTTPS.");
  const secret = process.env.MAINTENANCE_JOB_SECRET;
  if (!secret || secret.length < 32)
    throw new Error("Configure MAINTENANCE_JOB_SECRET securely.");
  const target = new URL("/api/jobs", origin);
  if (process.argv.includes("--health"))
    target.searchParams.set("health", "true");
  const response = await fetch(target, {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}` },
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok)
    throw new Error(
      `Maintenance requires attention (HTTP ${response.status}); inspect the private event desk.`,
    );
  const result = await response.json();
  console.log(JSON.stringify(result));
}
void main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Maintenance failed.");
  process.exitCode = 1;
});
