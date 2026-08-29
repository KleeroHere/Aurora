import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MIN_PASSWORD_LENGTH, PASSWORD_RULES_HINT, checkPassword } from "./passwordRules";

const PLACES = [
  "../components/StartupGate/LoginScreen.tsx",
  "../components/AdminGate/AdminGate.tsx",
  "../components/UserAvatar/UserAvatar.tsx",
  "../pages/SettingsPage.tsx",
];

function source(relative: string): string {
  return readFileSync(new URL(relative, import.meta.url) as unknown as string, "utf-8") as unknown as string;
}

describe("every password rule", () => {
  it("an empty password is not accepted", () => {
    expect(checkPassword("").ok).toBe(false);
    expect(checkPassword("   ").ok).toBe(false);
  });

  it("shorter than the minimum - with a clear reason, not \"wrong password\"", () => {
    const result = checkPassword("1234567");
    expect(result.ok).toBe(false);
    expect(result.error).toContain(String(MIN_PASSWORD_LENGTH));
  });

  it("exactly the minimum - accepted", () => {
    expect(checkPassword("berries1").ok).toBe(true);
  });

  it("the shipped default password is not accepted in any case", () => {
    expect(checkPassword("aurora").ok).toBe(false);
    expect(checkPassword("AURORA").ok).toBe(false);
    expect(checkPassword("Aurora").ok).toBe(false);
  });

  it("obvious passwords are not accepted", () => {
    for (const bad of ["password", "12345678", "qwerty"]) {
      expect(checkPassword(bad).ok, `"${bad}" must be rejected`).toBe(false);
    }
  });

  it("repeated and sequential characters are not accepted", () => {
    expect(checkPassword("aaaaaaaa").ok).toBe(false);
    expect(checkPassword("11111111").ok).toBe(false);
    expect(checkPassword("0123456789").ok).toBe(false);
  });

  it("surrounding spaces are not accepted - the person will not see them but will fail to log in", () => {
    const result = checkPassword(" berries1 ");
    expect(result.ok).toBe(false);
    expect(result.error).toContain("space");
  });

  it("a confirmation mismatch is its own clear reason", () => {
    const result = checkPassword("cloudberry-rowan", "cloudberry-raspberry");
    expect(result.ok).toBe(false);
    expect(result.error).toBe("Passwords do not match.");
  });

  it("a matching confirmation does not get in the way", () => {
    expect(checkPassword("cloudberry-rowan", "cloudberry-rowan").ok).toBe(true);
  });

  it("no confirmation is required where none is given", () => {
    expect(checkPassword("cloudberry-rowan").ok).toBe(true);
  });

  it("a short but acceptable password gets advice, not a rejection", () => {
    const result = checkPassword("berries1");
    expect(result.ok).toBe(true);
    expect(result.hint).toBeTruthy();
  });

  it("a long password gets no advice", () => {
    const result = checkPassword("cloudberry rowan viburnum");
    expect(result.ok).toBe(true);
    expect(result.hint).toBeNull();
  });

  it("the caption under the field names the minimum length", () => {
    expect(PASSWORD_RULES_HINT).toContain(String(MIN_PASSWORD_LENGTH));
  });
});

describe("the rules really live in one place", () => {
  it("all four password-change spots use the shared field and shared rules", () => {
    for (const place of PLACES) {
      const text = source(place);
      expect(text, `${place}: the password field must be the shared one`).toContain("PasswordField");
    }
  });

  it("the spots where the password is SET check against the shared rules", () => {
    for (const place of PLACES.filter((p) => !p.includes("AdminGate"))) {
      expect(source(place), `${place}: must call checkPassword`).toContain("checkPassword");
    }
  });

  it("none of them still has a bare input type=password", () => {
    for (const place of PLACES) {
      expect(source(place), `${place}: a field bypassing the shared component remains`).not.toContain(
        'type="password"',
      );
    }
  });
});
