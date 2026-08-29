import { describe, expect, it } from "vitest";
import { probeServer } from "./replication";
import type { ReplicationServer } from "./replication";

const server: ReplicationServer = {
  id: "primary",
  label: "Hub",
  url: "http://hub.tailnet.ts.net:5984/",
  username: "sync-user",
  password: "secret",
};

function fakeFetch(status: number, capture?: { url?: string; auth?: string | null }) {
  return (async (url: RequestInfo | URL, init?: RequestInit) => {
    if (capture) {
      capture.url = String(url);
      capture.auth = (init?.headers as Record<string, string> | undefined)?.Authorization ?? null;
    }
    return { ok: status >= 200 && status < 300, status } as Response;
  }) as typeof fetch;
}

describe("probeServer: connection check without syncing", () => {
  it("200 — the server is alive and the credentials were accepted", async () => {
    const capture: { url?: string; auth?: string | null } = {};
    const result = await probeServer(server, fakeFetch(200, capture));
    expect(result.ok).toBe(true);
    expect(capture.url).toBe("http://hub.tailnet.ts.net:5984/_up");
    expect(capture.auth).toBe("Basic " + btoa("sync-user:secret"));
    expect(capture.url).not.toContain("secret");
  });

  it("401 — the connection works, the credentials are the problem, and that is exactly what the user is told", async () => {
    const result = await probeServer(server, fakeFetch(401));
    expect(result.ok).toBe(false);
    expect(result.message).toContain("connection is fine");
    expect(result.message).toContain("name or password");
  });

  it("server silent — advice about Tailscale and the address, without technical jargon", async () => {
    const failing = (async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;
    const result = await probeServer(server, failing);
    expect(result.ok).toBe(false);
    expect(result.message).toContain("Tailscale");
    expect(result.message).not.toMatch(/fetch|TypeError/i);
  });

  it("empty address — immediate refusal, without going to the network", async () => {
    const result = await probeServer({ ...server, url: "  " }, fakeFetch(200));
    expect(result.ok).toBe(false);
    expect(result.message).toContain("not set");
  });

  it("without a username the Authorization header is not sent", async () => {
    const capture: { url?: string; auth?: string | null } = {};
    await probeServer({ ...server, username: "", password: "" }, fakeFetch(200, capture));
    expect(capture.auth).toBeNull();
  });
});
