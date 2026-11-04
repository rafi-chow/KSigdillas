import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  scryptSync,
  scrypt,
  timingSafeEqual,
} from "node:crypto";
export const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export const opaqueToken = () => randomBytes(32).toString("base64url");
export function passwordHash(value: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(value, salt, 64).toString("hex")}`;
}
export function passwordMatches(value: string, encoded: string) {
  const [salt, hash] = encoded.split(":");
  if (!salt || !hash || value.length > 256) return false;
  const candidate = scryptSync(value, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return (
    candidate.length === expected.length && timingSafeEqual(candidate, expected)
  );
}
export async function passwordMatchesAsync(value: string, encoded: string) {
  const [salt, hash] = encoded.split(":");
  if (!salt || !hash || value.length > 256) return false;
  return new Promise<boolean>((resolve) =>
    scrypt(value, salt, 64, (error, candidate) => {
      if (error) return resolve(false);
      const expected = Buffer.from(hash, "hex");
      resolve(
        candidate.length === expected.length &&
          timingSafeEqual(candidate, expected),
      );
    }),
  );
}
export function encryptionKey() {
  const key = process.env.TICKET_ENCRYPTION_KEY;
  if (!key || !/^[a-f0-9]{64}$/i.test(key))
    throw new Error("Ticket encryption is not configured.");
  return Buffer.from(key, "hex");
}
export function seal(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const bytes = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), bytes]).toString("base64url");
}
export function unseal(value: string) {
  const bytes = Buffer.from(value, "base64url");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    bytes.subarray(0, 12),
  );
  decipher.setAuthTag(bytes.subarray(12, 28));
  return Buffer.concat([
    decipher.update(bytes.subarray(28)),
    decipher.final(),
  ]).toString("utf8");
}
