const GITHUB_API = "https://api.github.com";

export interface GitHubUser {
  login: string;
  avatar_url: string;
  name: string | null;
}

export interface PullRequest {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: string;
  html_url: string;
  user: { login: string; avatar_url: string };
  head: { ref: string; sha: string; repo: { full_name: string } };
  base: { ref: string; repo: { full_name: string; owner: { login: string }; name: string } };
  created_at: string;
  updated_at: string;
  draft: boolean;
  additions: number;
  deletions: number;
  changed_files: number;
}

export interface PRFile {
  sha: string;
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
}

export interface ReviewComment {
  id: number;
  body: string;
  path: string;
  line?: number;
  user: { login: string; avatar_url: string };
  created_at: string;
}

function headers(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

export async function getUser(token: string): Promise<GitHubUser> {
  const res = await fetch(`${GITHUB_API}/user`, { headers: headers(token) });
  if (!res.ok) throw new Error("Failed to fetch user");
  return res.json();
}

export async function getOpenPRs(token: string): Promise<PullRequest[]> {
  const res = await fetch(
    `${GITHUB_API}/search/issues?q=is:pr+is:open+review-requested:@me+OR+author:@me&sort=updated&per_page=30`,
    { headers: headers(token) },
  );
  if (!res.ok) throw new Error("Failed to fetch PRs");
  const data = await res.json();

  // The search API returns issues, we need to fetch full PR data
  const prs = await Promise.all(
    data.items.map(async (item: { pull_request: { url: string } }) => {
      const prRes = await fetch(item.pull_request.url, { headers: headers(token) });
      return prRes.json();
    }),
  );
  return prs;
}

export async function getPR(token: string, owner: string, repo: string, number: number): Promise<PullRequest> {
  const res = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/pulls/${number}`, {
    headers: headers(token),
  });
  if (!res.ok) throw new Error("Failed to fetch PR");
  return res.json();
}

export async function getPRFiles(token: string, owner: string, repo: string, number: number): Promise<PRFile[]> {
  const res = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/pulls/${number}/files?per_page=100`, {
    headers: headers(token),
  });
  if (!res.ok) throw new Error("Failed to fetch PR files");
  return res.json();
}

export async function getPRComments(
  token: string,
  owner: string,
  repo: string,
  number: number,
): Promise<ReviewComment[]> {
  const res = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/pulls/${number}/comments?per_page=100`, {
    headers: headers(token),
  });
  if (!res.ok) throw new Error("Failed to fetch PR comments");
  return res.json();
}

export async function submitReview(
  token: string,
  owner: string,
  repo: string,
  number: number,
  event: "APPROVE" | "REQUEST_CHANGES" | "COMMENT",
  body: string,
  comments?: { path: string; line: number; body: string }[],
) {
  const res = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/pulls/${number}/reviews`, {
    method: "POST",
    headers: { ...headers(token), "Content-Type": "application/json" },
    body: JSON.stringify({ event, body, comments: comments ?? [] }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || "Failed to submit review");
  }
  return res.json();
}

export async function createReviewComment(
  token: string,
  owner: string,
  repo: string,
  number: number,
  body: string,
  path: string,
  line: number,
  commitId: string,
) {
  const res = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/pulls/${number}/comments`, {
    method: "POST",
    headers: { ...headers(token), "Content-Type": "application/json" },
    body: JSON.stringify({ body, path, line, commit_id: commitId }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || "Failed to create comment");
  }
  return res.json();
}

/** Detect preview URL from PR comments and check runs */
export async function detectPreviewUrl(
  token: string,
  owner: string,
  repo: string,
  number: number,
): Promise<string | null> {
  // Check PR comments for known preview URL patterns
  const commentsRes = await fetch(
    `${GITHUB_API}/repos/${owner}/${repo}/issues/${number}/comments?per_page=50`,
    { headers: headers(token) },
  );
  if (commentsRes.ok) {
    const comments: { body: string }[] = await commentsRes.json();
    for (const comment of comments) {
      const patterns = [
        /https:\/\/[a-z0-9-]+\.vercel\.app/i,
        /https:\/\/deploy-preview-\d+--[a-z0-9-]+\.netlify\.app/i,
        /https:\/\/[a-z0-9-]+-[a-z0-9]+\.vercel\.app/i,
      ];
      for (const pattern of patterns) {
        const match = comment.body?.match(pattern);
        if (match) return match[0];
      }
    }
  }

  // Check commit statuses / check runs for deployment URLs
  const prRes = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/pulls/${number}`, {
    headers: headers(token),
  });
  if (prRes.ok) {
    const pr = await prRes.json();
    const sha = pr.head.sha;
    const checksRes = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/commits/${sha}/check-runs?per_page=50`, {
      headers: headers(token),
    });
    if (checksRes.ok) {
      const checks = await checksRes.json();
      for (const run of checks.check_runs ?? []) {
        if (run.details_url) {
          const patterns = [/vercel\.app/, /netlify\.app/];
          for (const pattern of patterns) {
            if (pattern.test(run.details_url)) return run.details_url;
          }
        }
      }
    }
  }

  return null;
}
