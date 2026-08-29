import { describe, expect, it } from "vitest";
import { uint8ArrayToBase64 } from "./binary";

function makeBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  for (let i = 0; i < length; i++) bytes[i] = i % 256;
  return bytes;
}

describe("uint8ArrayToBase64", () => {
  it("matches reference Buffer encoding across sizes", () => {
    for (const size of [0, 1, 3, 4, 100, 0x8000 - 1, 0x8000, 0x8000 + 1, 0x8000 * 2 + 5]) {
      const bytes = makeBytes(size);
      const expected = Buffer.from(bytes).toString("base64");
      expect(uint8ArrayToBase64(bytes)).toBe(expected);
    }
  });

  it("decodes back to the same bytes (round-trip via atob)", () => {
    const bytes = makeBytes(0x8000 * 3 + 17);
    const encoded = uint8ArrayToBase64(bytes);
    const decoded = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));
    expect(decoded).toEqual(bytes);
  });

  it("linear in time, not quadratic (regression to per-character concatenation)", () => {
    const small = makeBytes(200_000);
    const large = makeBytes(4_000_000); // 20x larger

    const t0 = performance.now();
    uint8ArrayToBase64(small);
    const smallMs = performance.now() - t0;

    const t1 = performance.now();
    uint8ArrayToBase64(large);
    const largeMs = performance.now() - t1;

    expect(largeMs).toBeLessThan(Math.max(smallMs, 1) * 50);
  });
});
