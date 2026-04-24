const SUPABASE_URL = "https://qjudwaprmyicbtznjjlj.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFqdWR3YXBybXlpY2J0em5qamxqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4NzE5ODIsImV4cCI6MjA5MjQ0Nzk4Mn0.0PHwkNCKBH7zfSQshs53VKUYeZk5jtEZ_4twQFxeMWs";

export type Session = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  email?: string;
};

export class AuthError extends Error {}

function b64url(buf: ArrayBuffer): string {
  let s = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function randomVerifier(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return b64url(bytes.buffer);
}

async function challenge(verifier: string): Promise<string> {
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier)
  );
  return b64url(hash);
}

async function storeSession(data: {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
  user?: { email?: string };
}): Promise<Session> {
  const session: Session = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Math.floor(Date.now() / 1000) + (data.expires_in ?? 3600),
    email: data.user?.email,
  };
  await chrome.storage.local.set({ session });
  return session;
}

export async function signInWithGoogle(): Promise<Session> {
  const verifier = randomVerifier();
  const codeChallenge = await challenge(verifier);
  const redirectUri = chrome.identity.getRedirectURL();

  const url = new URL(`${SUPABASE_URL}/auth/v1/authorize`);
  url.searchParams.set("provider", "google");
  url.searchParams.set("redirect_to", redirectUri);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "s256");

  const redirectResult = await chrome.identity.launchWebAuthFlow({
    url: url.toString(),
    interactive: true,
  });
  if (!redirectResult) throw new AuthError("auth flow cancelled");

  const returned = new URL(redirectResult);
  const code =
    returned.searchParams.get("code") ||
    new URLSearchParams(returned.hash.replace(/^#/, "")).get("code");
  if (!code) {
    const errDesc =
      returned.searchParams.get("error_description") ||
      returned.searchParams.get("error") ||
      "no code in redirect";
    throw new AuthError(errDesc);
  }

  const tokenRes = await fetch(
    `${SUPABASE_URL}/auth/v1/token?grant_type=pkce`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ auth_code: code, code_verifier: verifier }),
    }
  );
  if (!tokenRes.ok) {
    const text = await tokenRes.text().catch(() => "");
    throw new AuthError(
      `token exchange failed: ${tokenRes.status} ${text.slice(0, 200)}`
    );
  }
  return storeSession(await tokenRes.json());
}

async function refresh(refreshToken: string): Promise<Session | null> {
  const res = await fetch(
    `${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    }
  );
  if (!res.ok) {
    await chrome.storage.local.remove("session");
    return null;
  }
  return storeSession(await res.json());
}

export async function getSession(): Promise<Session | null> {
  const stored = await chrome.storage.local.get("session");
  const s = stored.session as Session | undefined;
  if (!s) return null;
  const now = Math.floor(Date.now() / 1000);
  if (s.expires_at - 60 > now) return s;
  return refresh(s.refresh_token);
}

export async function signOut(): Promise<void> {
  const stored = await chrome.storage.local.get("session");
  const s = stored.session as Session | undefined;
  if (s) {
    await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${s.access_token}`,
      },
    }).catch(() => {});
  }
  await chrome.storage.local.remove("session");
}

export async function authedFetch(
  url: string,
  init: RequestInit = {}
): Promise<Response> {
  const session = await getSession();
  if (!session) throw new AuthError("no session");
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${session.access_token}`);
  const res = await fetch(url, { ...init, headers });
  if (res.status === 401) {
    await chrome.storage.local.remove("session");
    throw new AuthError("session expired");
  }
  return res;
}
