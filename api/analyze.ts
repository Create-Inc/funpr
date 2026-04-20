import type { VercelRequest, VercelResponse } from "@vercel/node";

// Cap the total prompt size so a large PR cannot blow out the token budget
// (or cost) of the downstream AI call.
const PER_FILE_PATCH_LIMIT = 2000;
const TOTAL_DIFF_CHAR_BUDGET = 40_000;

interface DiffFile {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  patch?: string;
}

async function validateGitHubToken(token: string): Promise<boolean> {
  try {
    const r = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
    return r.ok;
  } catch (e) {
    console.error("[analyze] github token validation failed:", e);
    return false;
  }
}

function buildDiffSummary(files: DiffFile[]): string {
  const parts: string[] = [];
  let used = 0;
  for (const f of files) {
    const patch = f.patch ? f.patch.slice(0, PER_FILE_PATCH_LIMIT) : "(no patch)";
    const entry = `File: ${f.filename} (${f.status}, +${f.additions} -${f.deletions})\n${patch}`;
    if (used + entry.length > TOTAL_DIFF_CHAR_BUDGET) {
      parts.push(`... (${files.length - parts.length} more files omitted to stay under token budget)`);
      break;
    }
    parts.push(entry);
    used += entry.length + 2; // +2 for the join separator
  }
  return parts.join("\n\n");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(501).json({ error: "AI analysis not configured" });
  }

  // Require a GitHub token and verify it with GitHub so this endpoint
  // cannot be abused by unauthenticated callers to burn our AI budget.
  const authHeader = req.headers.authorization || "";
  const bearer = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : "";
  const bodyToken = typeof req.body?.token === "string" ? req.body.token : "";
  const token = bearer || bodyToken;
  if (!token) {
    return res.status(401).json({ error: "Missing auth token" });
  }
  const ok = await validateGitHubToken(token);
  if (!ok) {
    return res.status(401).json({ error: "Invalid auth token" });
  }

  const { files } = req.body ?? {};
  if (!files || !Array.isArray(files)) {
    return res.status(400).json({ error: "Missing files" });
  }

  const diffSummary = buildDiffSummary(files as DiffFile[]);

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: `Analyze this PR diff and identify the affected areas that a reviewer should test. Group by feature area, route, or component.

Return JSON only (no markdown fences), in this format:
[{"title": "Area name", "description": "What changed and what to test", "files": ["file1.ts", "file2.ts"]}]

Diff:
${diffSummary}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      console.error("[analyze] anthropic non-ok:", response.status, body.slice(0, 300));
      return res.status(502).json({ error: "AI API call failed" });
    }

    const data = (await response.json()) as { content?: Array<{ text?: string }> };
    const text = data.content?.[0]?.text || "[]";

    let areas: Array<{ title: string; description: string; files: string[] }>;
    try {
      areas = JSON.parse(text);
    } catch (e) {
      console.error("[analyze] failed to parse AI response:", e, "raw:", text.slice(0, 300));
      return res.status(502).json({ error: "Failed to parse AI response" });
    }

    return res.json({
      areas: areas.map((a, i) => ({
        id: `area-${i}`,
        title: a.title,
        description: a.description,
        files: a.files,
        checked: false,
      })),
    });
  } catch (e) {
    console.error("[analyze] handler threw:", e);
    return res.status(500).json({ error: "Analysis failed" });
  }
}
