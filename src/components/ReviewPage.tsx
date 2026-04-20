import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Route } from "../routes/review.$owner.$repo.$number";
import {
  ArrowLeft,
  PanelRightClose,
  PanelRightOpen,
  Check,
  MessageSquare,
  X,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { useAuth } from "../lib/auth-context";
import { getPR, getPRFiles, detectPreviewUrl, submitReview, createReviewComment, PullRequest, PRFile } from "../lib/github";
import { analyzeDiff, AffectedArea } from "../lib/analyze";
import { FileDiff } from "./FileDiff";

export function ReviewPage() {
  const { owner, repo, number } = Route.useParams();
  const { token } = useAuth();
  const navigate = useNavigate();

  const [pr, setPr] = useState<PullRequest | null>(null);
  const [files, setFiles] = useState<PRFile[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [customUrl, setCustomUrl] = useState("");
  const [areas, setAreas] = useState<AffectedArea[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<"areas" | "files" | "review">("areas");
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [previewError, setPreviewError] = useState(false);

  // Review state
  const [reviewEvent, setReviewEvent] = useState<"APPROVE" | "REQUEST_CHANGES" | "COMMENT">("COMMENT");
  const [reviewBody, setReviewBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [reviewSubmitted, setReviewSubmitted] = useState(false);

  // Inline comment state
  const [commentFile, setCommentFile] = useState<string | null>(null);
  const [commentLine, setCommentLine] = useState<number | null>(null);
  const [commentBody, setCommentBody] = useState("");
  const [postingComment, setPostingComment] = useState(false);

  const prNumber = parseInt(number, 10);

  useEffect(() => {
    if (!token) return;

    async function load() {
      setLoading(true);
      try {
        const [prData, filesData] = await Promise.all([
          getPR(token!, owner, repo, prNumber),
          getPRFiles(token!, owner, repo, prNumber),
        ]);
        setPr(prData);
        setFiles(filesData);

        const [url, areasData] = await Promise.all([
          detectPreviewUrl(token!, owner, repo, prNumber),
          analyzeDiff(filesData, token!),
        ]);
        setPreviewUrl(url);
        setAreas(areasData);
      } catch (e) {
        console.error("Failed to load PR data:", e);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [token, owner, repo, prNumber]);

  const toggleFile = (filename: string) => {
    setExpandedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(filename)) next.delete(filename);
      else next.add(filename);
      return next;
    });
  };

  const toggleArea = (id: string) => {
    setAreas((prev) => prev.map((a) => (a.id === id ? { ...a, checked: !a.checked } : a)));
  };

  const handleSubmitReview = async () => {
    if (!token || !reviewBody.trim()) return;
    setSubmitting(true);
    try {
      await submitReview(token, owner, repo, prNumber, reviewEvent, reviewBody);
      setReviewSubmitted(true);
      setReviewBody("");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to submit review");
    } finally {
      setSubmitting(false);
    }
  };

  const handlePostComment = async () => {
    if (!token || !pr || !commentFile || commentLine === null || !commentBody.trim()) return;
    setPostingComment(true);
    try {
      await createReviewComment(token, owner, repo, prNumber, commentBody, commentFile, commentLine, pr.head.sha);
      setCommentFile(null);
      setCommentLine(null);
      setCommentBody("");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to post comment");
    } finally {
      setPostingComment(false);
    }
  };

  const effectivePreviewUrl = previewUrl || customUrl || null;

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Top bar */}
      <header className="flex items-center gap-3 border-b border-gray-800 px-4 py-2">
        <button
          onClick={() => navigate({ to: "/" } as any)}
          className="rounded p-1.5 text-gray-400 transition hover:bg-gray-800 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <span className="truncate text-sm font-medium">
            {owner}/{repo}#{number}
          </span>
          {pr && <span className="ml-2 truncate text-sm text-gray-500">{pr.title}</span>}
        </div>
        <a
          href={pr?.html_url}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded p-1.5 text-gray-400 transition hover:bg-gray-800 hover:text-white"
        >
          <ExternalLink className="h-4 w-4" />
        </a>
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="rounded p-1.5 text-gray-400 transition hover:bg-gray-800 hover:text-white"
        >
          {sidebarOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
        </button>
      </header>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Preview iframe */}
        <div className="flex-1">
          {effectivePreviewUrl && !previewError ? (
            <iframe
              src={effectivePreviewUrl}
              className="h-full w-full border-0"
              title="Deploy preview"
              onError={() => setPreviewError(true)}
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-4 text-gray-500">
              <AlertCircle className="h-12 w-12" />
              {previewError ? (
                <>
                  <p className="text-lg">Preview failed to load</p>
                  <p className="max-w-md text-center text-sm">
                    The preview host may block iframing via X-Frame-Options. Try opening it directly.
                  </p>
                  {effectivePreviewUrl && (
                    <a
                      href={effectivePreviewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 rounded bg-gray-800 px-4 py-2 text-sm text-gray-300 hover:bg-gray-700"
                    >
                      Open preview in new tab <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </>
              ) : (
                <>
                  <p className="text-lg">No preview URL detected</p>
                  <p className="max-w-md text-center text-sm">
                    Paste a deploy preview URL below, or ensure your CI posts Vercel/Netlify preview links on the PR.
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={customUrl}
                      onChange={(e) => setCustomUrl(e.target.value)}
                      placeholder="https://my-preview.vercel.app"
                      className="w-80 rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-blue-500 focus:outline-none"
                    />
                    <button
                      onClick={() => {
                        if (customUrl) setPreviewError(false);
                      }}
                      disabled={!customUrl}
                      className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500 disabled:opacity-50"
                    >
                      Load
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Sidebar */}
        {sidebarOpen && (
          <aside className="flex w-96 shrink-0 flex-col border-l border-gray-800 bg-gray-950">
            {/* Tabs */}
            <div className="flex border-b border-gray-800">
              {(["areas", "files", "review"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 px-3 py-2.5 text-sm font-medium capitalize transition ${
                    activeTab === tab ? "border-b-2 border-blue-500 text-white" : "text-gray-500 hover:text-gray-300"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-auto">
              {/* Areas tab */}
              {activeTab === "areas" && (
                <div className="p-4">
                  <p className="mb-3 text-xs text-gray-500 uppercase">Affected Areas</p>
                  {areas.length === 0 ? (
                    <p className="text-sm text-gray-600">No affected areas detected.</p>
                  ) : (
                    <div className="space-y-2">
                      {areas.map((area) => (
                        <label
                          key={area.id}
                          className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-800 p-3 transition hover:border-gray-700"
                        >
                          <input
                            type="checkbox"
                            checked={area.checked}
                            onChange={() => toggleArea(area.id)}
                            className="mt-0.5 h-4 w-4 rounded border-gray-600 bg-gray-800 text-blue-500"
                          />
                          <div className="min-w-0">
                            <div className={`text-sm font-medium ${area.checked ? "text-gray-500 line-through" : ""}`}>
                              {area.title}
                            </div>
                            <div className="mt-0.5 text-xs text-gray-500">{area.description}</div>
                            <div className="mt-1 flex flex-wrap gap-1">
                              {area.files.map((f) => (
                                <button
                                  key={f}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    setActiveTab("files");
                                    setExpandedFiles((prev) => new Set([...prev, f]));
                                  }}
                                  className="truncate rounded bg-gray-800 px-1.5 py-0.5 text-xs text-gray-400 hover:bg-gray-700 hover:text-gray-300"
                                  title={f}
                                >
                                  {f.split("/").pop()}
                                </button>
                              ))}
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                  <div className="mt-4 text-xs text-gray-600">
                    {areas.filter((a) => a.checked).length}/{areas.length} tested
                  </div>
                </div>
              )}

              {/* Files tab */}
              {activeTab === "files" && (
                <div className="p-4">
                  <p className="mb-3 text-xs text-gray-500 uppercase">
                    Changed Files ({files.length})
                  </p>
                  <div className="space-y-1">
                    {files.map((file) => (
                      <div key={file.filename} className="rounded border border-gray-800">
                        <button
                          onClick={() => toggleFile(file.filename)}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-900"
                        >
                          {expandedFiles.has(file.filename) ? (
                            <ChevronDown className="h-3 w-3 shrink-0 text-gray-500" />
                          ) : (
                            <ChevronRight className="h-3 w-3 shrink-0 text-gray-500" />
                          )}
                          <span className="min-w-0 flex-1 truncate" title={file.filename}>
                            {file.filename}
                          </span>
                          <span className="shrink-0 text-xs text-green-500">+{file.additions}</span>
                          <span className="shrink-0 text-xs text-red-500">-{file.deletions}</span>
                        </button>

                        {expandedFiles.has(file.filename) && (
                          <div className="border-t border-gray-800">
                            <FileDiff
                              file={file}
                              onComment={(line) => {
                                setCommentFile(file.filename);
                                setCommentLine(line);
                                setCommentBody("");
                              }}
                            />

                            {/* Inline comment form */}
                            {commentFile === file.filename && commentLine !== null && (
                              <div className="border-t border-gray-800 p-3">
                                <p className="mb-2 text-xs text-gray-500">
                                  Comment on line {commentLine}
                                </p>
                                <textarea
                                  value={commentBody}
                                  onChange={(e) => setCommentBody(e.target.value)}
                                  placeholder="Leave a comment..."
                                  rows={3}
                                  className="w-full rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-blue-500 focus:outline-none"
                                />
                                <div className="mt-2 flex gap-2">
                                  <button
                                    onClick={handlePostComment}
                                    disabled={postingComment || !commentBody.trim()}
                                    className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-blue-500 disabled:opacity-50"
                                  >
                                    {postingComment ? "Posting..." : "Post Comment"}
                                  </button>
                                  <button
                                    onClick={() => {
                                      setCommentFile(null);
                                      setCommentLine(null);
                                    }}
                                    className="rounded px-3 py-1.5 text-xs text-gray-400 transition hover:bg-gray-800"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Review tab */}
              {activeTab === "review" && (
                <div className="p-4">
                  <p className="mb-3 text-xs text-gray-500 uppercase">Submit Review</p>

                  {reviewSubmitted && (
                    <div className="mb-4 flex items-center gap-2 rounded-lg bg-green-950 border border-green-800 p-3 text-sm text-green-300">
                      <Check className="h-4 w-4" />
                      Review submitted successfully!
                    </div>
                  )}

                  <div className="mb-4 space-y-2">
                    {(
                      [
                        { value: "APPROVE", label: "Approve", color: "text-green-400" },
                        { value: "REQUEST_CHANGES", label: "Request Changes", color: "text-red-400" },
                        { value: "COMMENT", label: "Comment", color: "text-gray-300" },
                      ] as const
                    ).map(({ value, label, color }) => (
                      <label
                        key={value}
                        className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition ${
                          reviewEvent === value
                            ? "border-blue-600 bg-blue-950/30"
                            : "border-gray-800 hover:border-gray-700"
                        }`}
                      >
                        <input
                          type="radio"
                          name="review-event"
                          value={value}
                          checked={reviewEvent === value}
                          onChange={() => setReviewEvent(value)}
                          className="h-4 w-4 border-gray-600 bg-gray-800 text-blue-500"
                        />
                        <span className={`text-sm font-medium ${color}`}>{label}</span>
                      </label>
                    ))}
                  </div>

                  <textarea
                    value={reviewBody}
                    onChange={(e) => setReviewBody(e.target.value)}
                    placeholder="Write your review..."
                    rows={6}
                    className="w-full rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-blue-500 focus:outline-none"
                  />

                  <button
                    onClick={handleSubmitReview}
                    disabled={submitting || !reviewBody.trim()}
                    className="mt-3 w-full rounded bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-500 disabled:opacity-50"
                  >
                    {submitting ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" /> Submitting...
                      </span>
                    ) : (
                      "Submit Review"
                    )}
                  </button>
                </div>
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
