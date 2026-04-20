import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import handler from "./callback";
import { makeReq, makeRes, stubFetchOnce } from "../../tests/helpers";
import type { VercelRequest, VercelResponse } from "@vercel/node";

// Silence the handler's expected `console.error` calls on the unhappy paths so
// the test output stays clean — we still assert the visible side effects.
beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  process.env.GITHUB_CLIENT_ID = "test-client-id";
  process.env.GITHUB_CLIENT_SECRET = "test-client-secret";
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("GET /api/auth/callback", () => {
  it("rejects OAuth provider errors with 400", async () => {
    const req = makeReq({ query: { error: "access_denied" } });
    const res = makeRes();
    await handler(req as unknown as VercelRequest, res as unknown as VercelResponse);

    expect(res.statusCode).toBe(400);
    expect(res.jsonBody).toMatchObject({ error: expect.stringContaining("access_denied") });
  });

  it("rejects missing code parameter", async () => {
    const req = makeReq({ query: { state: "abc" } });
    const res = makeRes();
    await handler(req as unknown as VercelRequest, res as unknown as VercelResponse);

    expect(res.statusCode).toBe(400);
    expect(res.jsonBody).toEqual({ error: "Missing code parameter" });
  });

  it("rejects missing state parameter", async () => {
    const req = makeReq({ query: { code: "abc" } });
    const res = makeRes();
    await handler(req as unknown as VercelRequest, res as unknown as VercelResponse);

    expect(res.statusCode).toBe(400);
    expect(res.jsonBody).toEqual({ error: "Missing state parameter" });
  });

  it("rejects when the state cookie is missing (CSRF)", async () => {
    const req = makeReq({
      query: { code: "abc", state: "xyz" },
      headers: { cookie: "other=1" },
    });
    const res = makeRes();
    await handler(req as unknown as VercelRequest, res as unknown as VercelResponse);

    expect(res.statusCode).toBe(400);
    expect(res.jsonBody).toEqual({ error: "Invalid OAuth state" });
  });

  it("rejects when the state cookie does not match the state param (CSRF)", async () => {
    const req = makeReq({
      query: { code: "abc", state: "xyz" },
      headers: { cookie: "gh_oauth_state=different" },
    });
    const res = makeRes();
    await handler(req as unknown as VercelRequest, res as unknown as VercelResponse);

    expect(res.statusCode).toBe(400);
    expect(res.jsonBody).toEqual({ error: "Invalid OAuth state" });
  });

  it("returns 500 when OAuth env vars are not configured", async () => {
    delete process.env.GITHUB_CLIENT_ID;
    delete process.env.GITHUB_CLIENT_SECRET;

    const req = makeReq({
      query: { code: "abc", state: "xyz" },
      headers: { cookie: "gh_oauth_state=xyz" },
    });
    const res = makeRes();
    await handler(req as unknown as VercelRequest, res as unknown as VercelResponse);

    expect(res.statusCode).toBe(500);
    expect(res.jsonBody).toEqual({ error: "GitHub OAuth not configured" });
  });

  it("returns 502 when GitHub token exchange returns a non-ok response", async () => {
    stubFetchOnce([{ ok: false, status: 500, text: "boom" }]);

    const req = makeReq({
      query: { code: "abc", state: "xyz" },
      headers: { cookie: "gh_oauth_state=xyz" },
    });
    const res = makeRes();
    await handler(req as unknown as VercelRequest, res as unknown as VercelResponse);

    expect(res.statusCode).toBe(502);
    expect(res.jsonBody).toEqual({ error: "Failed to exchange OAuth code" });
  });

  it("returns 400 when the token response contains a provider error", async () => {
    stubFetchOnce([
      {
        ok: true,
        status: 200,
        json: { error: "bad_verification_code", error_description: "code expired" },
      },
    ]);

    const req = makeReq({
      query: { code: "abc", state: "xyz" },
      headers: { cookie: "gh_oauth_state=xyz" },
    });
    const res = makeRes();
    await handler(req as unknown as VercelRequest, res as unknown as VercelResponse);

    expect(res.statusCode).toBe(400);
    expect(res.jsonBody).toEqual({ error: "code expired" });
  });

  it("returns 500 when fetch throws", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );

    const req = makeReq({
      query: { code: "abc", state: "xyz" },
      headers: { cookie: "gh_oauth_state=xyz" },
    });
    const res = makeRes();
    await handler(req as unknown as VercelRequest, res as unknown as VercelResponse);

    expect(res.statusCode).toBe(500);
    expect(res.jsonBody).toEqual({ error: "OAuth exchange failed" });
    // The original error must be surfaced to the server log, not swallowed.
    expect(console.error).toHaveBeenCalledWith(
      "[oauth] exchange threw:",
      expect.any(Error),
    );
  });

  it("on success redirects to / with token in the URL fragment and clears state cookie", async () => {
    stubFetchOnce([{ ok: true, status: 200, json: { access_token: "ghs_secret/value+more" } }]);

    const req = makeReq({
      query: { code: "abc", state: "xyz" },
      headers: {
        cookie: "gh_oauth_state=xyz",
        host: "funpr.example.com",
      },
    });
    const res = makeRes();
    await handler(req as unknown as VercelRequest, res as unknown as VercelResponse);

    // State cookie is cleared with security attributes on success.
    expect(res.headers["set-cookie"]).toBeTruthy();
    expect(res.headers["set-cookie"]).toMatch(/gh_oauth_state=;/);
    expect(res.headers["set-cookie"]).toMatch(/HttpOnly/);
    expect(res.headers["set-cookie"]).toMatch(/SameSite=Lax/);
    expect(res.headers["set-cookie"]).toMatch(/Secure/);
    expect(res.headers["set-cookie"]).toMatch(/Max-Age=0/);

    // Redirect must put the token in the fragment (#) so it is not sent to
    // servers, logged, or forwarded via Referer — this is the whole point of
    // the security hardening the review asked for.
    expect(res.redirectStatus).toBe(302);
    expect(res.redirectUrl).toBeTruthy();
    const url = new URL(res.redirectUrl as string);
    expect(url.origin).toBe("https://funpr.example.com");
    expect(url.pathname).toBe("/");
    expect(url.search).toBe("");
    expect(url.hash).toBe(`#token=${encodeURIComponent("ghs_secret/value+more")}`);
  });
});
