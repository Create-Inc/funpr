import type { VercelRequest, VercelResponse } from "@vercel/node";

const STATE_COOKIE = "gh_oauth_state";

function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) return {};
  return Object.fromEntries(
    header.split(";").map((c) => {
      const [k, ...v] = c.trim().split("=");
      return [k, decodeURIComponent(v.join("="))];
    }),
  );
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { code, state, error: oauthError } = req.query;

  if (oauthError) {
    console.error("[oauth] provider returned error:", oauthError);
    return res.status(400).json({ error: `OAuth error: ${oauthError}` });
  }

  if (!code || typeof code !== "string") {
    return res.status(400).json({ error: "Missing code parameter" });
  }

  if (!state || typeof state !== "string") {
    return res.status(400).json({ error: "Missing state parameter" });
  }

  // CSRF protection: state must match the value we set on the authorize redirect.
  const cookies = parseCookies(req.headers.cookie);
  const cookieState = cookies[STATE_COOKIE];
  if (!cookieState || cookieState !== state) {
    console.error("[oauth] state mismatch", { hasCookie: !!cookieState });
    return res.status(400).json({ error: "Invalid OAuth state" });
  }

  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return res.status(500).json({ error: "GitHub OAuth not configured" });
  }

  try {
    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
      }),
    });

    if (!tokenRes.ok) {
      const body = await tokenRes.text().catch(() => "");
      console.error("[oauth] token endpoint non-ok", tokenRes.status, body.slice(0, 300));
      return res.status(502).json({ error: "Failed to exchange OAuth code" });
    }

    const data = (await tokenRes.json()) as {
      access_token?: string;
      error?: string;
      error_description?: string;
    };

    if (data.error || !data.access_token) {
      console.error("[oauth] token exchange error:", data.error, data.error_description);
      return res.status(400).json({ error: data.error_description || data.error || "No access token" });
    }

    // Clear the state cookie — it's single-use.
    res.setHeader("Set-Cookie", `${STATE_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax; Secure`);

    // Redirect back to the app with the token in the URL fragment (#).
    // Fragments are NOT sent to servers, not written to access logs, and
    // not sent in referrer headers, which avoids the main leakage paths
    // of passing tokens via the query string.
    const redirectUrl = new URL("/", `https://${req.headers.host}`);
    redirectUrl.hash = `token=${encodeURIComponent(data.access_token)}`;
    return res.redirect(302, redirectUrl.toString());
  } catch (e) {
    console.error("[oauth] exchange threw:", e);
    return res.status(500).json({ error: "OAuth exchange failed" });
  }
}
