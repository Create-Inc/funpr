import { vi } from "vitest";

// Minimal shape compatible with what our handlers read/write on req/res.
// We intentionally avoid importing VercelRequest/VercelResponse here so the
// helper is test-only and doesn't pull runtime deps into src/.
export interface MockReq {
  method?: string;
  query: Record<string, string | string[] | undefined>;
  headers: Record<string, string | undefined>;
  body?: unknown;
}

export interface MockRes {
  statusCode: number;
  headers: Record<string, string>;
  jsonBody?: unknown;
  redirectUrl?: string;
  redirectStatus?: number;
  status: (code: number) => MockRes;
  json: (body: unknown) => MockRes;
  setHeader: (name: string, value: string) => void;
  redirect: (status: number, url: string) => MockRes;
}

export function makeReq(init: Partial<MockReq> = {}): MockReq {
  return {
    method: init.method ?? "GET",
    query: init.query ?? {},
    headers: init.headers ?? {},
    body: init.body,
  };
}

export function makeRes(): MockRes {
  const res: MockRes = {
    statusCode: 200,
    headers: {},
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(body: unknown) {
      res.jsonBody = body;
      return res;
    },
    setHeader(name: string, value: string) {
      res.headers[name.toLowerCase()] = value;
    },
    redirect(status: number, url: string) {
      res.redirectStatus = status;
      res.redirectUrl = url;
      return res;
    },
  };
  return res;
}

/**
 * Replace global.fetch with a mock that returns a scripted response per call.
 * Returns the mock so the test can inspect calls and restore it via mockRestore.
 */
export function stubFetchOnce(
  responses: Array<{ ok?: boolean; status?: number; json?: unknown; text?: string }>,
) {
  let i = 0;
  const mock = vi.fn(async () => {
    const r = responses[Math.min(i, responses.length - 1)];
    i += 1;
    const ok = r.ok ?? (r.status ? r.status >= 200 && r.status < 300 : true);
    return {
      ok,
      status: r.status ?? (ok ? 200 : 500),
      json: async () => r.json ?? {},
      text: async () => r.text ?? (r.json ? JSON.stringify(r.json) : ""),
    } as unknown as Response;
  });
  vi.stubGlobal("fetch", mock);
  return mock;
}
