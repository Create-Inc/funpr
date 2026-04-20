import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import handler from "./analyze";
import { makeReq, makeRes, stubFetchOnce } from "../tests/helpers";
import type { VercelRequest, VercelResponse } from "@vercel/node";

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  process.env.ANTHROPIC_API_KEY = "test-anthropic-key";
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  delete process.env.ANTHROPIC_API_KEY;
});

describe("POST /api/analyze", () => {
  it("rejects non-POST methods with 405", async () => {
    const req = makeReq({ method: "GET" });
    const res = makeRes();
    await handler(req as unknown as VercelRequest, res as unknown as VercelResponse);

    expect(res.statusCode).toBe(405);
    expect(res.jsonBody).toEqual({ error: "Method not allowed" });
  });

  it("returns 501 when ANTHROPIC_API_KEY is not configured", async () => {
    delete process.env.ANTHROPIC_API_KEY;

    const req = makeReq({ method: "POST", body: { files: [] } });
    const res = makeRes();
    await handler(req as unknown as VercelRequest, res as unknown as VercelResponse);

    expect(res.statusCode).toBe(501);
    expect(res.jsonBody).toEqual({ error: "AI analysis not configured" });
  });

  it("rejects requests with no auth token (401)", async () => {
    const req = makeReq({ method: "POST", body: { files: [] } });
    const res = makeRes();
    await handler(req as unknown as VercelRequest, res as unknown as VercelResponse);

    expect(res.statusCode).toBe(401);
    expect(res.jsonBody).toEqual({ error: "Missing auth token" });
  });

  it("rejects requests whose token GitHub rejects (401)", async () => {
    // GitHub /user returns non-ok for the provided token.
    const fetchMock = stubFetchOnce([{ ok: false, status: 401 }]);

    const req = makeReq({
      method: "POST",
      headers: { authorization: "Bearer bogus" },
      body: { files: [] },
    });
    const res = makeRes();
    await handler(req as unknown as VercelRequest, res as unknown as VercelResponse);

    expect(res.statusCode).toBe(401);
    expect(res.jsonBody).toEqual({ error: "Invalid auth token" });
    // Only the GitHub validation request should have been made — never call
    // the paid Anthropic API for an unauthenticated caller.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.github.com/user");
  });

  it("rejects requests with no `files` array (400) after auth succeeds", async () => {
    stubFetchOnce([{ ok: true, status: 200 }]); // GitHub /user OK

    const req = makeReq({
      method: "POST",
      headers: { authorization: "Bearer good-token" },
      body: {},
    });
    const res = makeRes();
    await handler(req as unknown as VercelRequest, res as unknown as VercelResponse);

    expect(res.statusCode).toBe(400);
    expect(res.jsonBody).toEqual({ error: "Missing files" });
  });

  it("accepts the token from the request body as a fallback to the Authorization header", async () => {
    const fetchMock = stubFetchOnce([{ ok: true, status: 200 }]);

    const req = makeReq({
      method: "POST",
      body: { token: "body-token", files: "not-an-array" },
    });
    const res = makeRes();
    await handler(req as unknown as VercelRequest, res as unknown as VercelResponse);

    // Auth passed (we got past 401), we just fail on `files` validation.
    expect(res.statusCode).toBe(400);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const authUsed = (fetchMock.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(authUsed.Authorization).toBe("Bearer body-token");
  });

  it("returns 502 when the Anthropic API returns a non-ok response", async () => {
    stubFetchOnce([
      { ok: true, status: 200 }, // GitHub /user
      { ok: false, status: 500, text: "anthropic boom" }, // Anthropic
    ]);

    const req = makeReq({
      method: "POST",
      headers: { authorization: "Bearer good-token" },
      body: { files: [{ filename: "a.ts", status: "modified", additions: 1, deletions: 0, patch: "@@" }] },
    });
    const res = makeRes();
    await handler(req as unknown as VercelRequest, res as unknown as VercelResponse);

    expect(res.statusCode).toBe(502);
    expect(res.jsonBody).toEqual({ error: "AI API call failed" });
  });

  it("returns 502 when the Anthropic response body is not valid JSON", async () => {
    stubFetchOnce([
      { ok: true, status: 200 },
      { ok: true, status: 200, json: { content: [{ text: "this is not json" }] } },
    ]);

    const req = makeReq({
      method: "POST",
      headers: { authorization: "Bearer good-token" },
      body: { files: [{ filename: "a.ts", status: "modified", additions: 1, deletions: 0, patch: "@@" }] },
    });
    const res = makeRes();
    await handler(req as unknown as VercelRequest, res as unknown as VercelResponse);

    expect(res.statusCode).toBe(502);
    expect(res.jsonBody).toEqual({ error: "Failed to parse AI response" });
    // Error must be logged, not swallowed — this was the original reviewer concern.
    expect(console.error).toHaveBeenCalledWith(
      "[analyze] failed to parse AI response:",
      expect.any(Error),
      "raw:",
      expect.any(String),
    );
  });

  it("returns structured areas on success", async () => {
    const areas = [
      { title: "Auth flow", description: "OAuth callback hardening", files: ["api/auth/callback.ts"] },
      { title: "AI endpoint", description: "Adds auth + budget cap", files: ["api/analyze.ts"] },
    ];
    stubFetchOnce([
      { ok: true, status: 200 }, // GitHub
      { ok: true, status: 200, json: { content: [{ text: JSON.stringify(areas) }] } },
    ]);

    const req = makeReq({
      method: "POST",
      headers: { authorization: "Bearer good-token" },
      body: {
        files: [
          { filename: "api/auth/callback.ts", status: "modified", additions: 10, deletions: 2, patch: "@@" },
          { filename: "api/analyze.ts", status: "modified", additions: 20, deletions: 1, patch: "@@" },
        ],
      },
    });
    const res = makeRes();
    await handler(req as unknown as VercelRequest, res as unknown as VercelResponse);

    expect(res.statusCode).toBe(200);
    expect(res.jsonBody).toEqual({
      areas: [
        { id: "area-0", title: "Auth flow", description: "OAuth callback hardening", files: ["api/auth/callback.ts"], checked: false },
        { id: "area-1", title: "AI endpoint", description: "Adds auth + budget cap", files: ["api/analyze.ts"], checked: false },
      ],
    });
  });

  it("logs the original error when the handler throws unexpectedly", async () => {
    // GitHub /user returns ok, but the second fetch (Anthropic) throws.
    let call = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        call += 1;
        if (call === 1) {
          return { ok: true, status: 200, json: async () => ({}), text: async () => "" } as unknown as Response;
        }
        throw new Error("kaboom");
      }),
    );

    const req = makeReq({
      method: "POST",
      headers: { authorization: "Bearer good-token" },
      body: { files: [{ filename: "a.ts", status: "modified", additions: 1, deletions: 0, patch: "@@" }] },
    });
    const res = makeRes();
    await handler(req as unknown as VercelRequest, res as unknown as VercelResponse);

    expect(res.statusCode).toBe(500);
    expect(res.jsonBody).toEqual({ error: "Analysis failed" });
    expect(console.error).toHaveBeenCalledWith("[analyze] handler threw:", expect.any(Error));
  });
});
