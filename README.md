# Studio Scheduler (trial build)

A small internal tool: instructors submit their availability through a
personal link, and the studio owner generates a draft weekly class schedule
with one click (Claude does the balancing), then edits and approves it.

## Stack

- Next.js 16 (App Router, TypeScript, Tailwind)
- Supabase (Postgres) — data storage, accessed server-side only
- Claude API (Sonnet) — drafts the schedule from availability + requirements
- Deploys to Vercel

## 1. Database (Supabase)

1. Create a project at [supabase.com](https://supabase.com) (or reuse an
   existing one — this app's tables live under `public` and won't collide
   with anything else, as long as those table names aren't already in use).
2. In the Supabase SQL Editor, run everything in `supabase/schema.sql`.
3. From Project Settings → API, grab:
   - **Project URL** → `SUPABASE_URL`
   - **service_role key** (not the anon key — this app uses the service role
     key server-side only, since every table has Row Level Security on with
     no policies) → `SUPABASE_SERVICE_ROLE_KEY`

## 2. Claude API key

Create a key at [platform.claude.com](https://platform.claude.com) →
`ANTHROPIC_API_KEY`. Costs for this tool are tiny — a generated schedule run
is a few cents at most; see the note you sent along with this.

## 3. Local setup

```bash
npm install
cp .env.example .env.local   # fill in the three values above, plus OWNER_PASSWORD
npm run dev
```

Visit `http://localhost:3000`, log in with `OWNER_PASSWORD`, add an
instructor, and copy their invite link to test the intake form.

## 4. Push to GitHub

```bash
git remote add origin <your-empty-repo-url>
git push -u origin main
```

## 5. Deploy on Vercel

1. Import the GitHub repo in the Vercel dashboard.
2. Add the four environment variables from `.env.local` in Project Settings
   → Environment Variables (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
   `ANTHROPIC_API_KEY`, `OWNER_PASSWORD`).
3. Deploy. Every push to `main` redeploys automatically, same as your other
   repos.

## How it works

- **Owner dashboard** (`/dashboard`, password-gated): add instructors and
  get their invite link, set up the studio's required weekly class slots,
  generate a draft schedule, edit it in the grid, and approve it.
- **Instructor intake** (`/instructor/[token]`): no login — the link itself
  is the access. Instructor submits their weekly availability and any notes.
- **Generation**: pulls all availability + the required slots, sends it to
  Claude with a forced structured-output tool call so the response always
  comes back as clean, parseable JSON (day/time/format/instructor) rather
  than free text you'd have to parse yourself. Claude is told the hard rules
  (never double-book, never assign a format someone doesn't teach) and does
  best-effort on soft preferences, and leaves a slot unassigned rather than
  break a rule — flagging it in the summary.
- **Editing**: the generated grid is fully editable before approving —
  nothing is final until the owner says so.

## What's intentionally left out of this trial version

- No Hapana integration — pulling class-demand/attendance data from Hapana
  automatically wasn't clearly documented as a public API, so this version
  treats availability + fairness as the only inputs. Worth revisiting once
  it's confirmed what data Hapana actually exposes.
- No per-instructor login — a single owner password plus unique instructor
  links is enough for a free trial with one studio. Would want real auth
  (NextAuth, etc.) if this becomes a permanent tool.
- No automatic reminders to instructors who haven't submitted yet — could
  add a Resend email nudge if that turns out to be needed.
