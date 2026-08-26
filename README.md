# Serene Pilates · Studio Scheduler

An internal tool for Serene Pilates. Instructors submit their availability and
what they teach; the studio owner gets a complete month of classes drafted for
them, then tweaks it instead of building it from a blank calendar.

Styled to match [serenepilates.ca](https://www.serenepilates.ca) — same palette,
same Inter typography, same logo.

---

## How it works

There are two screens, and only one of them needs a password.

### The instructor's screen — `/instructor/<their-token>`

Each instructor gets a **private link** with a token in it. No account, no
password: the link *is* their access, and it only ever shows their own details.
The owner copies it from the dashboard and sends it however they like (text,
email, WhatsApp).

On that page an instructor:

1. **Taps what they teach.** The formats the studio actually runs are offered as
   chips, so this stays accurate; they can add anything missing.
2. **Turns on the days they're free** and sets the hours for each. These are
   weekly windows — "Mondays 8am–12pm" — that apply to every week of the month.
3. **Adds anything else in one text box** — "mornings only", "no back-to-back
   classes", "away the last week". This is read in full when the schedule is
   drafted, so one-off time off goes here rather than needing its own field.

They can reopen the link any time before the schedule goes out; the form comes
back pre-filled and re-submitting replaces their previous answer.

### The owner's screen — `/dashboard`

Behind the single studio password (`OWNER_PASSWORD`). It opens on **next month**
— the one being planned — with ‹ › in the header to reach any other month.

Three numbered steps, top to bottom:

1. **Your team** — add instructors, copy each one's private link, and watch
   "Waiting" flip to "Submitted" as they come in. Click **View** on anyone who
   has submitted to see their exact windows and what they wrote.
2. **Weekly class template** — the classes the studio runs every week
   ("Reformer, Mondays 9am"). Set once; it carries month to month.
3. **Draft for `<month>`** — press **Draft the schedule**.

The draft is a real month: the weekly template expanded across every week, each
class on its actual date, grouped by week. Every row has an instructor dropdown,
so changing someone is one click. Above the table you get a plain-language
summary of what the draft did and where it got stuck, a count of anything still
needing cover, and each instructor's class count so you can eyeball fairness.

Then either:

- **Save changes** — keep editing later.
- **Approve schedule** — mark it final.
- **Delete draft** — throw it away and start over. Asks once, then it's gone and
  the month is blank again. **Re-draft schedule** in the header does the same
  thing in one step if you just want a different attempt.

---

## How the drafting works

Dates are computed in code, not guessed: the weekly template is expanded across
the real calendar month first, so no class is ever dropped or invented. Claude
is then asked only to choose *who* covers each class, given everyone's
availability, formats, and written preferences.

Four rules are treated as hard, and every assignment is re-checked against them
in code afterwards — anything that breaks one is cleared and called out in the
summary rather than quietly shipped:

1. The class must sit inside one of that instructor's submitted windows.
2. They must teach that format.
3. No overlapping classes on the same day.
4. Nobody who hasn't submitted gets assigned.

Beyond that it balances the load across the month, keeps each instructor's week
consistent, and tries to give the same person the same recurring class each week
so members see a familiar face. When it can't fill something without breaking a
rule, it leaves the slot empty and says why.

---

## Setup

1. **Database** — run [`supabase/schema.sql`](supabase/schema.sql) against your
   Supabase project (SQL Editor → paste → run). RLS is on with no policies; the
   app only ever reaches the database server-side with the service role key.

2. **Environment** — copy `.env.example` to `.env.local` and fill in:

   | Variable | Where it comes from |
   | --- | --- |
   | `SUPABASE_URL` | Project Settings → Data API → Project URL (the full `https://…supabase.co`) |
   | `SUPABASE_SERVICE_ROLE_KEY` | Project Settings → API Keys → `service_role` |
   | `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com/settings/keys) |
   | `OWNER_PASSWORD` | Any strong string — this is the studio login |

3. **Run** — `npm install && npm run dev`, then open http://localhost:3000.

---

## Notes

- **Scheduling periods are calendar months**, identified everywhere by the ISO
  date of the first day (`2026-09-01`). Invite links carry `?period=` so an
  instructor's form always matches the month the owner is planning.
- **All dates are handled in local time.** Going via `toISOString()` would shift
  the day for anyone west of UTC and silently move a schedule into the wrong
  month — see [`lib/period.ts`](lib/period.ts).
- **The password gate is deliberately simple** — one shared password for one
  studio owner, not a multi-tenant product. Swap [`lib/auth.ts`](lib/auth.ts)
  for real auth if this grows.
