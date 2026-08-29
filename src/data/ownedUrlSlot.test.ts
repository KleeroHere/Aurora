import { describe, expect, it, vi } from "vitest";
import { createOwnedUrlSlot } from "./ownedUrlSlot";

describe("createOwnedUrlSlot", () => {
  it("memory is bounded: no matter how much is printed, only the last two stay alive", () => {
    const revoke = vi.fn();
    const slot = createOwnedUrlSlot(revoke);

    for (let i = 1; i <= 10; i += 1) slot.adopt(`blob:${i}`);

    expect(revoke.mock.calls.map(([url]) => url)).toEqual([
      "blob:1", "blob:2", "blob:3", "blob:4", "blob:5", "blob:6", "blob:7", "blob:8",
    ]);
    expect(slot.current).toBe("blob:10");
  });

  it("the previous URL survives the next request - a double click does not kill the first print", () => {
    const revoke = vi.fn();
    const slot = createOwnedUrlSlot(revoke);

    slot.adopt("blob:first");
    slot.adopt("blob:second");

    expect(revoke).not.toHaveBeenCalled();
  });

  it("the first URL triggers no release - there is nothing to release yet", () => {
    const revoke = vi.fn();
    const slot = createOwnedUrlSlot(revoke);
    slot.adopt("blob:1");
    expect(revoke).not.toHaveBeenCalled();
  });

  it("a repeated request with the same URL does not revoke it out from under an open panel", () => {
    const revoke = vi.fn();
    const slot = createOwnedUrlSlot(revoke);
    slot.adopt("blob:1");
    slot.adopt("blob:1");
    expect(revoke).not.toHaveBeenCalled();
    expect(slot.current).toBe("blob:1");
  });

  it("disown drops ownership WITHOUT touching a foreign URL", () => {
    const revoke = vi.fn();
    const slot = createOwnedUrlSlot(revoke);
    slot.adopt("blob:own");
    slot.disown();

    expect(revoke).not.toHaveBeenCalled();
    expect(slot.current).toBeNull();

    slot.release();
    expect(revoke).not.toHaveBeenCalled();
  });

  it("release frees EVERYTHING held and empties the slot", () => {
    const revoke = vi.fn();
    const slot = createOwnedUrlSlot(revoke);
    slot.adopt("blob:1");
    slot.adopt("blob:2");
    slot.release();

    expect(revoke.mock.calls.map(([url]) => url)).toEqual(["blob:1", "blob:2"]);
    expect(slot.current).toBeNull();

    slot.release();
    expect(revoke).toHaveBeenCalledTimes(2);
  });

  it("a foreign URL after an owned one: the owned is released, the foreign is not adopted", () => {
    const revoke = vi.fn();
    const slot = createOwnedUrlSlot(revoke);

    slot.adopt("blob:own");
    slot.release();
    slot.disown();

    expect(revoke).toHaveBeenCalledExactlyOnceWith("blob:own");
    expect(slot.current).toBeNull();
  });
});
