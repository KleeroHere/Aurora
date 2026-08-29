import { describe, expect, it } from "vitest";
import { formatLongDate, formatShortDate } from "./dateFormat";

function localIso(year: number, monthIndex: number, day: number, hour = 10): string {
  return new Date(year, monthIndex, day, hour).toISOString();
}

describe("formatShortDate", () => {
  it("mm/dd/yyyy format", () => {
    expect(formatShortDate(localIso(2026, 7, 2))).toBe("08/02/2026");
  });

  it("single-digit day/month are zero-padded", () => {
    expect(formatShortDate(localIso(2026, 0, 5))).toBe("01/05/2026");
  });
});

describe("formatLongDate", () => {
  it("\"month-name day, year\" format", () => {
    expect(formatLongDate(localIso(2026, 7, 2))).toBe("August 2, 2026");
  });

  it("single-digit day without a leading zero", () => {
    expect(formatLongDate(localIso(2026, 0, 5))).toBe("January 5, 2026");
  });
});
