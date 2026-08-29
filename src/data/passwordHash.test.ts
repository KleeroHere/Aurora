import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./passwordHash";

describe("hashPassword / verifyPassword", () => {
  it("the correct password passes verification", async () => {
    const hash = await hashPassword("aurora");
    expect(await verifyPassword("aurora", hash)).toBe(true);
  });

  it("a wrong password fails verification", async () => {
    const hash = await hashPassword("aurora");
    expect(await verifyPassword("not aurora", hash)).toBe(false);
  });

  it("the hash never stores the password in plain text", async () => {
    const hash = await hashPassword("aurora");
    expect(hash).not.toContain("aurora");
  });

  it("two hashes of the same password differ (random salt)", async () => {
    const a = await hashPassword("aurora");
    const b = await hashPassword("aurora");
    expect(a).not.toBe(b);
    expect(await verifyPassword("aurora", a)).toBe(true);
    expect(await verifyPassword("aurora", b)).toBe(true);
  });

  it("the hash format is self-describing (algorithm$iterations$salt$hash)", async () => {
    const hash = await hashPassword("x");
    const parts = hash.split("$");
    expect(parts).toHaveLength(4);
    expect(parts[0]).toBe("pbkdf2-sha256");
    expect(Number.parseInt(parts[1], 10)).toBeGreaterThan(0);
  });

  it("a corrupted/foreign hash format fails verification without throwing", async () => {
    await expect(verifyPassword("aurora", "not-a-hash-at-all")).resolves.toBe(false);
    await expect(verifyPassword("aurora", "argon2id$v=19$m=65536$abc$def")).resolves.toBe(false);
    await expect(verifyPassword("aurora", "")).resolves.toBe(false);
  });

  it("an empty password also hashes and verifies predictably", async () => {
    const hash = await hashPassword("");
    expect(await verifyPassword("", hash)).toBe(true);
    expect(await verifyPassword("x", hash)).toBe(false);
  });
});
