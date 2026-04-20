import type { PRFile } from "./github";

export interface AffectedArea {
  id: string;
  title: string;
  description: string;
  files: string[];
  checked: boolean;
}

/**
 * Analyze PR diff to identify affected areas.
 * If ANTHROPIC_API_KEY is configured on the server, this calls the AI endpoint.
 * Otherwise, falls back to a heuristic-based analysis.
 */
export async function analyzeDiff(files: PRFile[], token: string): Promise<AffectedArea[]> {
  // Try AI analysis first. We send the GitHub token via the Authorization
  // header (not in the JSON body) so the server can verify the caller is
  // authenticated and short-circuit anonymous abuse of the Anthropic key.
  try {
    const res = await fetch("/api/analyze", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ files }),
    });
    if (res.ok) {
      const data = await res.json();
      return data.areas;
    }
  } catch (e) {
    console.error("[analyze] /api/analyze call failed, falling back to heuristic:", e);
  }

  return heuristicAnalysis(files);
}

/** Group files by directory/feature area and generate human-readable summaries */
function heuristicAnalysis(files: PRFile[]): AffectedArea[] {
  const groups = new Map<string, PRFile[]>();

  for (const file of files) {
    const parts = file.filename.split("/");
    let area: string;

    // Identify area from file path
    if (file.filename.match(/\.(test|spec)\.(ts|tsx|js|jsx)$/)) {
      area = "Tests";
    } else if (parts.includes("components") || parts.includes("ui")) {
      area = `UI: ${parts[parts.indexOf("components") + 1] || parts[parts.indexOf("ui") + 1] || "Components"}`;
    } else if (parts.includes("routes") || parts.includes("pages")) {
      const routeFile = parts[parts.length - 1].replace(/\.(tsx?|jsx?)$/, "");
      area = `Route: /${routeFile === "index" ? parts[parts.length - 2] || "" : routeFile}`;
    } else if (parts.includes("api") || parts.includes("lib") || parts.includes("utils")) {
      area = `Logic: ${parts.slice(0, 2).join("/")}`;
    } else if (file.filename.match(/\.(css|scss|less)$/)) {
      area = "Styles";
    } else if (file.filename.match(/\.(json|yaml|yml|toml)$/)) {
      area = "Configuration";
    } else {
      area = parts.length > 1 ? parts[0] : "Root";
    }

    if (!groups.has(area)) groups.set(area, []);
    groups.get(area)!.push(file);
  }

  return Array.from(groups.entries()).map(([area, areaFiles], i) => {
    const totalAdded = areaFiles.reduce((s, f) => s + f.additions, 0);
    const totalRemoved = areaFiles.reduce((s, f) => s + f.deletions, 0);
    const desc = `${areaFiles.length} file${areaFiles.length > 1 ? "s" : ""} changed (+${totalAdded} -${totalRemoved})`;

    return {
      id: `area-${i}`,
      title: area,
      description: desc,
      files: areaFiles.map((f) => f.filename),
      checked: false,
    };
  });
}
