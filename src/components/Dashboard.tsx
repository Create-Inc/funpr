import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { GitBranch, GitPullRequest, LogOut, ExternalLink } from "lucide-react";
import { useAuth } from "../lib/auth-context";
import { getOpenPRs, PullRequest } from "../lib/github";

export function Dashboard() {
  const { user, token, signOut } = useAuth();
  const navigate = useNavigate();
  const [prs, setPrs] = useState<PullRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    getOpenPRs(token)
      .then(setPrs)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-gray-800 px-6 py-4">
        <div className="flex items-center gap-3">
          <GitBranch className="h-6 w-6 text-blue-400" />
          <span className="text-xl font-bold">Preview PR</span>
        </div>
        <div className="flex items-center gap-4">
          {user && (
            <div className="flex items-center gap-2">
              <img src={user.avatar_url} alt={user.login} className="h-8 w-8 rounded-full" />
              <span className="text-sm text-gray-300">{user.login}</span>
            </div>
          )}
          <button onClick={signOut} className="rounded p-2 text-gray-400 transition hover:bg-gray-800 hover:text-white">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-auto p-6">
        <h2 className="mb-6 text-2xl font-semibold">Your Open Pull Requests</h2>

        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-600 border-t-white" />
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-800 bg-red-950 p-4 text-red-300">
            Failed to load PRs: {error}
          </div>
        )}

        {!loading && !error && prs.length === 0 && (
          <div className="py-20 text-center text-gray-500">
            <GitPullRequest className="mx-auto mb-4 h-12 w-12" />
            <p>No open pull requests found.</p>
            <p className="mt-1 text-sm">PRs you authored or are requested to review will appear here.</p>
          </div>
        )}

        <div className="grid gap-3">
          {prs.map((pr) => (
            <button
              key={pr.id}
              onClick={() =>
                navigate({
                  to: `/review/${pr.base.repo.owner.login}/${pr.base.repo.name}/${pr.number}`,
                } as any)
              }
              className="flex items-start gap-4 rounded-lg border border-gray-800 p-4 text-left transition hover:border-gray-600 hover:bg-gray-900"
            >
              <GitPullRequest className="mt-1 h-5 w-5 shrink-0 text-green-400" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium">{pr.title}</span>
                  {pr.draft && (
                    <span className="shrink-0 rounded bg-gray-800 px-2 py-0.5 text-xs text-gray-400">Draft</span>
                  )}
                </div>
                <div className="mt-1 flex items-center gap-3 text-sm text-gray-500">
                  <span>{pr.base.repo.full_name}#{pr.number}</span>
                  <span>by {pr.user.login}</span>
                  <span>
                    +{pr.additions} -{pr.deletions}
                  </span>
                </div>
              </div>
              <a
                href={pr.html_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="shrink-0 text-gray-600 hover:text-gray-300"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}
