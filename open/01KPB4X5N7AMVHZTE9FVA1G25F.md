---
version: 1
id: 01KPB4X5N7AMVHZTE9FVA1G25F
status: open
labels:
  - spec
scope:
  ref: fc9819a0dbf44772c4fa935380c41d13a0c861af
  paths: []
created_by:
  user: unknown
created_at: 2026-04-16T12:40:26.023Z
updated_at: 2026-04-16T12:40:26.023Z
---

# Preview-Driven PR Review

# Preview-Driven PR Review

## What
A PR review tool where the primary UI is a full-bleed deploy preview (iframe), not a code diff. Sign in with GitHub, see your open PRs, pick one, and land in an interactive preview of the changes. AI analyzes the diff to surface affected routes/components as a testable checklist. Inline code diffs are available on-demand. Reviews (approve, request changes, line comments) sync back to GitHub.

## Why
GitHub's review flow is code-first — you read diffs and imagine what changed. This flips it: see the actual result first, then drill into code. Faster, more confident reviews, especially for frontend-heavy work.

## Category
ui

## Design Reference
Full-bleed iframe preview (~90% of viewport). Collapsible sidebar with:
- Affected areas checklist (AI-generated from diff)
- Inline code diffs (expandable per-file)
- Comment/review controls

Think: Vercel's preview comments UX meets GitHub's review API.

## Details

### Auth & Data
- GitHub OAuth (sign in with GitHub)
- All PR data via GitHub API (list PRs, diffs, post reviews/comments)
- Lightweight server for OAuth flow + optional caching (Vercel serverless functions)

### Frontend
- TanStack Router + Vite
- Deploy to Vercel

### Core Flow
1. User signs in with GitHub
2. Dashboard shows open PRs across their repos (fetched from GitHub API)
3. User selects a PR → enters review mode
4. Review mode:
   - Full-bleed iframe loads the deploy preview URL (auto-detected from PR comments/checks via AI, or user-configured)
   - Collapsible sidebar shows:
     - Affected areas checklist — AI analyzes the PR diff, identifies changed routes/components, and presents them as items to test
     - Code diffs — expandable per-file, with ability to leave inline comments
     - Review actions — approve, request changes, or comment (syncs to GitHub as a PR review)
5. Line-level comments on diffs sync back as GitHub PR review comments

### Preview URL Detection
- Search PR comments and check runs for known preview URL patterns (Vercel, Netlify, etc.)
- Fallback: user can paste/configure a preview URL pattern per repo

### AI Diff Analysis
- Send the PR diff to an LLM
- Output: list of affected routes/pages/components with brief descriptions of what changed
- Displayed as a checklist the reviewer can work through

## External Dependencies
- GITHUB_CLIENT_ID: NEEDS_PROVISIONING (GitHub OAuth App)
- GITHUB_CLIENT_SECRET: NEEDS_PROVISIONING (GitHub OAuth App)
- LLM API key for diff analysis (e.g. ANTHROPIC_API_KEY): NEEDS_PROVISIONING

## Constraints
- Preview iframe will be blocked by X-Frame-Options on some preview hosts — Vercel previews allow iframing by default, but others may not. Document this limitation.
- GitHub API rate limits apply — cache PR/diff data where possible.

## Boundaries
- Does NOT spin up its own deploy previews — relies on existing preview URLs (Vercel, Netlify, etc.)
- Does NOT replace GitHub's review system — it's a better frontend for it, reviews are stored in GitHub
- Does NOT support non-web projects in MVP (no mobile, no API-only repos)
- Does NOT do visual regression / screenshot diffing (future consideration)

## Verification
1. Sign in with GitHub OAuth — redirects back, shows user avatar
2. Dashboard lists open PRs from the user's repos
3. Select a PR that has a Vercel preview → full-bleed preview loads in iframe
4. Sidebar shows AI-generated list of affected areas from the diff
5. Expand a file diff, leave an inline comment → comment appears on the GitHub PR
6. Approve the PR from the sidebar → GitHub shows the approval
7. Collapsing/expanding the sidebar doesn't break the preview layout

## Related
None
