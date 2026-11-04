import { timingSafeEqual } from "node:crypto";
export function secretMatches(
  value: string | null | undefined,
  expected: string | undefined,
) {
  return Boolean(
    expected &&
    expected.length >= 32 &&
    value &&
    Buffer.byteLength(value) === Buffer.byteLength(expected) &&
    timingSafeEqual(Buffer.from(value), Buffer.from(expected)),
  );
}
