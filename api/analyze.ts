import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(501).json({ error: "AI analysis not configured" });
  }

  const { files } = req.body;
  if (!files || !Array.isArray(files)) {
    return res.status(400).json({ error: "Missing files" });
  }

  // Build a summary of the diff
  const diffSummary = files
    .map(
      (f: { filename: string; status: string; additions: number; deletions: number; patch?: string }) =>
        `File: ${f.filename} (${f.status}, +${f.additions} -${f.deletions})\n${f.patch ? f.patch.slice(0, 2000) : "(no patch)"}`,
    )
    .join("\n\n");

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
      return res.status(502).json({ error: "AI API call failed" });
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || "[]";

    let areas;
    try {
      areas = JSON.parse(text);
    } catch {
      return res.status(502).json({ error: "Failed to parse AI response" });
    }

    return res.json({
      areas: areas.map((a: { title: string; description: string; files: string[] }, i: number) => ({
        id: `area-${i}`,
        title: a.title,
        description: a.description,
        files: a.files,
        checked: false,
      })),
    });
  } catch (e) {
    return res.status(500).json({ error: "Analysis failed" });
  }
}
