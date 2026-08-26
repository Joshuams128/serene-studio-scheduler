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
2. **Sets when they're free.** A checkbox at the top — *"My days are the same
   every week"* — is ticked by default: fill in seven days once and it applies
   to the whole month. Untick it and the form splits into a tab per week
   (**Week 1 · Sep 1–6**, and so on), each with its own days, for anyone whose
   availability changes week to week. Each tab shows how many windows it has, so
   nothing gets missed.
3. **Adds anything else in one text box** — "mornings only", "no back-to-back
   classes". Read in full when the schedule is drafted.

Two shortcuts do most of the work: **"I'm free whenever the studio is open"**
fills every day with the studio's real opening hours, and in per-week mode
**"Copy to all weeks"** duplicates the week you're on so you only edit the one
that differs. Switching the checkbox back and forth never loses anything — both
drafts are kept.

They can reopen the link any time before the schedule goes out; the form comes
back pre-filled and re-submitting replaces their previous answer.

### The owner's screen — `/dashboard`

Behind the single studio password (`OWNER_PASSWORD`). It opens on **next month**
— the one being planned — with ‹ › in the header to reach any other month.

**First visit runs a guided tour** — eight steps with *Next tip* / *Back* /
*Skip tour*, each one scrolling to and ringing the part of the page it's
describing. It shows itself once per browser; the **?** button in the top
corner replays it any time. (Arrow keys step through it, Escape closes it.)

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

### Sending it out

At the bottom of the draft, **Send to instructors** emails the month to everyone
with an address on file. Each person gets the same email with **their own
classes at the top** and the full studio timetable underneath, so they can see
who else is on.

Before anything leaves:

- **Preview the email** opens the real thing in a new tab — nothing is sent.
- Pressing send lists every recipient by name and address and waits for a second
  confirmation.
- Anyone without an email address is named up front, so nobody is quietly
  skipped, and their card shows *"no email on file"*.
- If classes are still unfilled it says so — they'll appear as *"Needs cover"*.
- Afterwards you get a per-person result, and the panel shows *"Last sent 2
  hours ago to 6 instructors"* so you don't blast everyone twice by accident.

Replies go to `SCHEDULE_REPLY_TO` if set, otherwise to the From address.

---

## How the drafting works

Dates are computed in code, not guessed: the weekly template is expanded across
the real calendar month first, so no class is ever dropped or invented. Claude
is then asked only to choose *who* covers each class, given everyone's
availability, formats, and written preferences.

Four rules are treated as hard, and every assignment is re-checked against them
in code afterwards — anything that breaks one is cleared and called out in the
summary rather than quietly shipped:

1. The class must sit inside one of that instructor's submitted windows **for
   that specific week** — a window set for week 2 says nothing about week 3.
2. They must teach that format.
3. No overlapping classes on the same day.
4. Nobody who hasn't submitted gets assigned.

Beyond that it balances the load across the month, keeps each instructor's week
consistent, and tries to give the same person the same recurring class each week
so members see a familiar face. When it can't fill something without breaking a
rule, it leaves the slot empty and says why.

---

## Studio hours

The studio's real opening hours live in [`lib/studio.ts`](lib/studio.ts) and
drive defaults across the app — toggling a day on the instructor form offers
exactly those windows, and adding a class seeds the time from that day's opening.
Anything outside them is flagged rather than blocked.

| Days | Hours |
| --- | --- |
| Monday–Thursday | 6:30 AM – 12:00 PM, 5:30 PM – 8:30 PM |
| Friday | 7:30 AM – 12:00 PM, 4:00 PM – 6:00 PM |
| Saturday–Sunday | 9:00 AM – 2:00 PM |

Change them in that one file and every default, hint and warning follows.

---

## Setup

1. **Database** — run [`supabase/schema.sql`](supabase/schema.sql) against your
   Supabase project (SQL Editor → paste → run). It's safe to re-run over an
   existing database, and you'll need to **re-run it to pick up the `sent_at`
   columns** that the email feature records against. RLS is on with no policies;
   the app only ever reaches the database server-side with the service role key.

2. **Environment** — copy `.env.example` to `.env.local` and fill in:

   | Variable | Where it comes from |
   | --- | --- |
   | `SUPABASE_URL` | Project Settings → Data API → Project URL (the full `https://…supabase.co`) |
   | `SUPABASE_SERVICE_ROLE_KEY` | Project Settings → API Keys → `service_role` |
   | `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com/settings/keys) |
   | `OWNER_PASSWORD` | Any strong string — this is the studio login |

   Emailing schedules out is optional. Without these three the app works
   normally and only the send button is disabled, with a message saying what's
   missing:

   | Variable | Where it comes from |
   | --- | --- |
   | `RESEND_API_KEY` | [resend.com/api-keys](https://resend.com/api-keys) |
   | `SCHEDULE_FROM_EMAIL` | e.g. `Serene Pilates <schedule@serenepilates.ca>` — **the domain must be verified in Resend first** |
   | `SCHEDULE_REPLY_TO` | Optional — where instructor replies land |

3. **Run** — `npm install && npm run dev`, then open http://localhost:3000.

---

## Notes

- **Scheduling periods are calendar months**, identified everywhere by the ISO
  date of the first day (`2026-09-01`). Invite links carry `?period=` so an
  instructor's form always matches the month the owner is planning.
- **Availability slots carry an optional `week`** (1-indexed). Absent means "every
  week"; a number means that week only. A submission is in per-week mode if any
  of its slots carry one — no extra column, so no migration.
- **All dates are handled in local time.** Going via `toISOString()` would shift
  the day for anyone west of UTC and silently move a schedule into the wrong
  month — see [`lib/period.ts`](lib/period.ts).
- **The tour remembers it's been seen** in `localStorage`, per browser — so it
  runs once on the owner's laptop and once again if she opens it on her phone.
  Storage is wrapped in try/catch: if it's blocked, the tour just shows every
  time rather than erroring. Edit the steps in `TOUR_STEPS` at the top of
  [`app/dashboard/DashboardClient.tsx`](app/dashboard/DashboardClient.tsx).
- **Email is rendered as inline-styled tables** with no images or external
  assets — see [`lib/email.ts`](lib/email.ts). Mail clients strip `<style>`
  blocks and block remote images by default, so a typographic header in the
  brand colours survives where a logo wouldn't.
- **The password gate is deliberately simple** — one shared password for one
  studio owner, not a multi-tenant product. Swap [`lib/auth.ts`](lib/auth.ts)
  for real auth if this grows.
