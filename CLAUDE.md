# Quickstart.life — Session Handoff

## What's built (v1 shipped)
MV3 Chrome extension + Next.js backend + Supabase. Shutdown flow shows a prep screen with three prompt bullets ("talk about: what you were in the middle of / what you want to do next / anything you don't want to forget"), then records 30s of voice once the user clicks "Start recording". A "No mic? Input manually" link on the prep screen switches to a textarea as a fallback. Whisper transcribes, Claude (`claude-opus-4-7`) synthesizes a re-entry card, Supabase stores it, Resume reopens the tabs. Project CRUD is in the popup. Zero-projects / zero-capsules / first-Resume onboarding states ship. Google OAuth via Supabase Auth — popup shows a sign-in screen; backend verifies JWT on every route and lets RLS filter rows. Backend is live on VPS at `https://api.quickstart.life`.

## Key decisions and why
- **Sonnet 4.6 for synthesis**: downgraded from Opus 4.7 after v1 ship. Extraction + stylistic-rule task is well within Sonnet's range and costs ~5x less per capsule. Structured outputs were unavailable on Greg's key, so we parse JSON from the system prompt instead. Works reliably.
- **Hostinger VPS + Docker + Traefik**: Greg already pays for it, Traefik was pre-installed with Let's Encrypt. Zero timeout risk vs Netlify/Vercel serverless. Container on `network_mode: host`, Traefik labels drive routing + SSL.
- **Auth: Supabase Google OAuth, PKCE via `chrome.identity.launchWebAuthFlow`**: no supabase-js in the extension; ~140 lines of hand-rolled PKCE + token refresh in `extension/src/popup/auth.ts`. Backend's `getUserFromRequest` verifies the bearer token with the service-role client, then returns an anon client bound to the user's JWT so RLS does the filtering.
- **Rate limits + size caps live in `backend/lib/ratelimit.ts` and the route files**: in-memory sliding window, 30 hits/hour per user on `/api/capsule` and `/api/transcribe`. Transcripts capped at 10KB, tabs at 200, audio uploads at 5MB. Chosen so abuse can't drain OpenAI/Anthropic credits. In-memory is fine for a single-container deploy; if we ever scale horizontally, move to Redis or a Supabase table.
- **Prep-then-record two-step**: first iteration jumped straight into recording, which put users on the spot. Now clicking "Shut down" shows prompts and a "Start recording" button so the user can compose thoughts before speaking.
- **No capsule/transcript caching in `chrome.storage.local`**: DB is source of truth; `Resume` is the only way to surface a prior card. Only `lastProjectId`, `seenResumeTip`, and `session` persist.
- **No em-dashes, no "system" in copy**: enforced by Greg's rules. Watch for these in any new strings.

## What's next
- **Submitted to Chrome Web Store on 2026-04-24.** Google's review queue. Host-permission review extends typical 1-3 day approval to 1-2 weeks. Item ID assigned by the store: `dihjcledldacijfnkkidcbgcfmogbcpc`. Greg's dev install retains its old ID (`loakdpdkc...`); both redirect URLs are in Supabase's allowlist so both can sign in.
- **OAuth consent screen is in Production**, so once the extension is published any Google user can sign in (no test-user list).
- **If Greg ever wants to dodge the host-permission in-depth review for future updates**: rewrite `manifest.json` to use `optional_host_permissions` and request access at runtime via `chrome.permissions.request`. ~30-45 min of work; cuts review time back to 1-3 days.
- Future monetization (paid tier + 7-day trial) is a `subscriptions` table + Stripe + a plan-check middleware. Auth already separated cleanly, so this bolts on without touching the sign-in path.

## Gotchas
- `.env` on VPS at `/root/quickstart/backend/.env` — not in git, recreate manually if container is rebuilt from scratch. `QUICKSTART_USER_ID` is gone; ignore any old reference to it.
- VPS Traefik cert resolver is named `letsencrypt`; referenced by that exact name in compose labels.
- Extension's OAuth redirect URL is `https://<ext-id>.chromiumapp.org/*`. If the extension ID changes (new folder path, different Chrome profile, eventually Web Store publish), update the allowlist in Supabase → Auth → URL Configuration. Pinning the manifest `key` is the long-term fix.
- Supabase auto-linked Greg's old seeded `auth.users` row (`f4e2ae07...`) to his Google identity because the emails matched, so no migration was needed. New users get fresh UUIDs; their data is scoped to them via RLS.
- Chrome extensions cannot see non-browser apps (VS Code, etc.). If this comes up again, the cheap path is a "Other apps open?" input on the prep screen that feeds into the synthesis prompt. Native messaging is overkill.
- Memory and `ideas_for_later.md` are the parking lots; never build from `ideas_for_later.md` without explicit go-ahead.
- Greg has ADHD/dyslexia: one question at a time, bottom line first, short var names.
- Greg doesn't remember deploy mechanics between sessions. Deploy flow: commit locally → `git push origin main` → Hostinger browser terminal (hpanel.hostinger.com → VPS → Browser terminal) → `cd /root/quickstart && git pull origin main && cd backend && docker compose up -d --build`.
