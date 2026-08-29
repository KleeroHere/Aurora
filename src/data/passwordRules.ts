
export const MIN_PASSWORD_LENGTH = 8;

const FORBIDDEN = [
  "aurora", // the shipped default password - see DEFAULT_SEED_PASSWORD
  "password",
  "12345678",
  "123456789",
  "qwerty",
  "11111111",
];

export interface PasswordCheck {
  ok: boolean;
  error: string | null;
  hint: string | null;
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase("en-US");
}

function looksLikeSequence(value: string): boolean {
  const lower = normalize(value);
  return /^(.)\1+$/.test(lower) || /^(0123456789|abcdefgh|qwertyui)/.test(lower);
}

export function checkPassword(password: string, confirmation?: string): PasswordCheck {
  const value = password ?? "";

  if (value.trim().length === 0) {
    return { ok: false, error: "Enter a password.", hint: null };
  }
  if (value !== value.trim()) {
    return { ok: false, error: "The password must not start or end with a space.", hint: null };
  }
  if (value.length < MIN_PASSWORD_LENGTH) {
    return {
      ok: false,
      error: `The password is too short: it needs at least ${MIN_PASSWORD_LENGTH} characters.`,
      hint: null,
    };
  }
  if (FORBIDDEN.includes(normalize(value))) {
    return { ok: false, error: "That password is too obvious. Pick another one.", hint: null };
  }
  if (looksLikeSequence(value)) {
    return { ok: false, error: "A password of repeated or sequential characters will not do.", hint: null };
  }
  if (confirmation !== undefined && value !== confirmation) {
    return { ok: false, error: "Passwords do not match.", hint: null };
  }

  return {
    ok: true,
    error: null,
    hint:
      value.length < 12
        ? "That works. A long password beats a complex one: two or three ordinary words in a row are easier to remember and take longer to crack."
        : null,
  };
}

export const PASSWORD_RULES_HINT = `At least ${MIN_PASSWORD_LENGTH} characters. Two or three ordinary words in a row are stronger and easier to remember than "Aa1!".`;
