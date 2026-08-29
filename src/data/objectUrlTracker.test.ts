import { describe, expect, it, vi } from "vitest";
import { createObjectUrlTracker } from "./objectUrlTracker";

describe("createObjectUrlTracker", () => {
  it("track() remembers the URL and returns it back", () => {
    const tracker = createObjectUrlTracker();
    const url = tracker.track("blob:a");
    expect(url).toBe("blob:a");
    expect(tracker.size).toBe(1);
  });

  it("revokeAll() releases every tracked URL (cleanup-on-unmount test)", () => {
    const tracker = createObjectUrlTracker();
    tracker.track("blob:a");
    tracker.track("blob:b");
    const revoke = vi.fn();

    tracker.revokeAll(revoke);

    expect(revoke).toHaveBeenCalledTimes(2);
    expect(revoke).toHaveBeenCalledWith("blob:a");
    expect(revoke).toHaveBeenCalledWith("blob:b");
  });

  it("after revokeAll() the list is empty - a second call releases nothing (no double revoke)", () => {
    const tracker = createObjectUrlTracker();
    tracker.track("blob:a");
    const revoke = vi.fn();

    tracker.revokeAll(revoke);
    tracker.revokeAll(revoke);

    expect(revoke).toHaveBeenCalledTimes(1);
    expect(tracker.size).toBe(0);
  });

  it("track() of the same URL twice does not release it twice", () => {
    const tracker = createObjectUrlTracker();
    tracker.track("blob:a");
    tracker.track("blob:a");
    const revoke = vi.fn();

    tracker.revokeAll(revoke);

    expect(revoke).toHaveBeenCalledTimes(1);
  });

  it("without a revoke argument it defaults to URL.revokeObjectURL", () => {
    const tracker = createObjectUrlTracker();
    const spy = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    tracker.track("blob:default");

    tracker.revokeAll();

    expect(spy).toHaveBeenCalledWith("blob:default");
    spy.mockRestore();
  });
});
