import { describe, expect, it } from "vitest";
import { tourKeyAction } from "./tourKeys";

describe("keyboard handling while help is open", () => {
  it("Escape closes", () => {
    expect(tourKeyAction("Escape", false)).toBe("close");
    expect(tourKeyAction("Escape", true)).toBe("close");
  });

  it("arrow keys page through the steps", () => {
    expect(tourKeyAction("ArrowRight", false)).toBe("next");
    expect(tourKeyAction("ArrowLeft", false)).toBe("prev");
  });

  it("Enter outside a button pages forward", () => {
    expect(tourKeyAction("Enter", false)).toBe("next");
  });

  it("Enter on a button belongs to the button, not the tour", () => {
    expect(tourKeyAction("Enter", true)).toBeNull();
  });

  it("other keys do not affect the help", () => {
    for (const key of ["a", "Tab", "ArrowUp", "ArrowDown", " ", "Backspace", "F1"]) {
      expect(tourKeyAction(key, false), key).toBeNull();
      expect(tourKeyAction(key, true), key).toBeNull();
    }
  });
});
