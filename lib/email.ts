import { Resend } from "resend";
import type { Instructor, ScheduleAssignment } from "./types";
import { formatDate, formatTime, monthLabel, weeksInMonth } from "./period";
import { studioHoursSummary } from "./studio";
import {
  CATEGORY_PLURAL,
  categoryOf,
  toCategory,
  type Category,
} from "./categories";

/* ---------------------------------------------------------------------------
   Emailing a finished schedule out to the instructors it involves.

   Every instructor gets the same email with their own classes pulled to the
   top, then the full studio timetable underneath for context. Styles are
   inline and the layout is table-based — email clients strip <style> blocks
   and don't do flexbox or grid.
--------------------------------------------------------------------------- */

const INK = "#283517";
const FERN = "#606C37";
const SAGE = "#8A9A5B";
const MIST = "#B8C79D";
const CLAY = "#BC6C24";
const SAND = "#DDA05F";
const CREAM = "#FEFAE0";
const PAPER = "#FAF8F3";
const SHELL = "#FFFDF5";

const FONT =
  "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export type Recipient = {
  instructor: Instructor;
  classes: ScheduleAssignment[];
};

/**
 * Split the roster into who can actually be emailed and who is missing an
 * address — the dashboard shows both so nobody is silently skipped.
 */
export function buildRecipients(
  instructors: Instructor[],
  assignments: ScheduleAssignment[]
): { sendable: Recipient[]; missingEmail: Instructor[] } {
  const sendable: Recipient[] = [];
  const missingEmail: Instructor[] = [];

  for (const instructor of instructors) {
    const email = instructor.email?.trim();
    if (!email) {
      missingEmail.push(instructor);
      continue;
    }
    sendable.push({
      instructor,
      classes: assignments
        .filter((a) => a.instructorId === instructor.id)
        .sort((a, b) =>
          a.date === b.date
            ? a.start.localeCompare(b.start)
            : a.date.localeCompare(b.date)
        ),
    });
  }

  return { sendable, missingEmail };
}

/**
 * The categories relevant to one person: what they're actually assigned this
 * month, falling back to what their profile says they cover when they have
 * nothing on. Someone who only does concierge shifts should never get the whole
 * class timetable pushed at them.
 */
function relevantCategories(
  classes: ScheduleAssignment[],
  instructor: Instructor,
  formatCategories: Map<string, Category>
): Set<Category> {
  if (classes.length > 0) {
    return new Set(classes.map((c) => toCategory(c.category)));
  }
  const fromProfile = instructor.formats_taught.map((f) =>
    categoryOf(formatCategories, f)
  );
  // No assignments and no formats on file — show classes rather than nothing.
  return fromProfile.length > 0 ? new Set(fromProfile) : new Set<Category>(["class"]);
}

/** "9 classes", "4 shifts", "9 classes and 4 shifts" */
function describeWorkload(classes: ScheduleAssignment[]): string {
  const counts = { class: 0, shift: 0 };
  for (const c of classes) counts[toCategory(c.category)]++;

  const parts: string[] = [];
  for (const key of ["class", "shift"] as Category[]) {
    const n = counts[key];
    if (n === 0) continue;
    const noun = n === 1 ? (key === "class" ? "class" : "shift") : CATEGORY_PLURAL[key].toLowerCase();
    parts.push(`${n} ${noun}`);
  }
  return parts.join(" and ");
}

/** "classes", "shifts", "classes and shifts" */
function describeCategories(cats: Set<Category>): string {
  const parts = (["class", "shift"] as Category[])
    .filter((c) => cats.has(c))
    .map((c) => CATEGORY_PLURAL[c].toLowerCase());
  return parts.join(" and ");
}

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function classRows(classes: ScheduleAssignment[], showWho: boolean): string {
  return classes
    .map(
      (c) => `
        <tr>
          <td style="padding:10px 12px;border-top:1px solid ${MIST}55;font-size:14px;color:${FERN};white-space:nowrap;">${esc(
            formatDate(c.date)
          )}</td>
          <td style="padding:10px 12px;border-top:1px solid ${MIST}55;font-size:14px;color:${FERN};white-space:nowrap;">${esc(
            formatTime(c.start)
          )} – ${esc(formatTime(c.end))}</td>
          <td style="padding:10px 12px;border-top:1px solid ${MIST}55;font-size:14px;color:${INK};font-weight:500;">${esc(
            c.format
          )}${
            c.room
              ? `<span style="color:${SAGE};font-weight:400;font-size:12px;"> · ${esc(c.room)}</span>`
              : ""
          }</td>
          ${
            showWho
              ? `<td style="padding:10px 12px;border-top:1px solid ${MIST}55;font-size:14px;color:${
                  c.instructorName ? FERN : CLAY
                };white-space:nowrap;">${esc(c.instructorName ?? "Needs cover")}</td>`
              : ""
          }
        </tr>`
    )
    .join("");
}

function fullTimetable(
  periodStart: string,
  assignments: ScheduleAssignment[]
): string {
  const byDate = new Map<string, ScheduleAssignment[]>();
  for (const a of assignments) {
    byDate.set(a.date, [...(byDate.get(a.date) ?? []), a]);
  }

  return weeksInMonth(periodStart)
    .map((week) => {
      const classes = week.dates
        .flatMap((d) => byDate.get(d) ?? [])
        .sort((a, b) =>
          a.date === b.date
            ? a.start.localeCompare(b.start)
            : a.date.localeCompare(b.date)
        );
      if (classes.length === 0) return "";
      return `
        <tr><td colspan="4" style="padding:18px 12px 4px;font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:${SAGE};">${esc(
          week.label
        )}</td></tr>
        ${classRows(classes, true)}`;
    })
    .join("");
}

export function renderScheduleEmail({
  instructor,
  classes,
  periodStart,
  allAssignments,
  formatCategories,
  includeEveryone = true,
}: {
  instructor: Instructor;
  classes: ScheduleAssignment[];
  periodStart: string;
  allAssignments: ScheduleAssignment[];
  formatCategories: Map<string, Category>;
  /** false = just this person's own list, with no studio-wide timetable. */
  includeEveryone?: boolean;
}): { subject: string; html: string; text: string } {
  const month = monthLabel(periodStart);
  const firstName = instructor.name.split(" ")[0];
  const count = classes.length;

  // Only show the parts of the month this person has anything to do with.
  const mine = relevantCategories(classes, instructor, formatCategories);
  const relevant = includeEveryone
    ? allAssignments.filter((a) => mine.has(toCategory(a.category)))
    : [];
  const categoryWord = describeCategories(mine);

  const subject =
    count > 0
      ? `Your ${month} schedule — ${describeWorkload(classes)}`
      : `${month} schedule at Serene Pilates`;

  const intro =
    count > 0
      ? `Here are your ${esc(categoryWord)} for ${esc(month)} — ${describeWorkload(
          classes
        )} in total.`
      : includeEveryone
        ? `You're not down for any ${esc(categoryWord)} in ${esc(
            month
          )} at the moment. The full timetable is below in case anything changes.`
        : `You're not down for any ${esc(categoryWord)} in ${esc(
            month
          )} at the moment. We'll be in touch if that changes.`;

  const mineTable =
    count > 0
      ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:18px;background:${PAPER};border-radius:12px;">
           ${classRows(classes, false)}
         </table>`
      : "";

  const hours = studioHoursSummary()
    .map(
      (h) =>
        `<div style="font-size:12px;color:${SAGE};line-height:1.6;">${esc(
          h.days
        )} &nbsp;${esc(h.hours)}</div>`
    )
    .join("");

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:${PAPER};font-family:${FONT};-webkit-font-smoothing:antialiased;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(intro.replace(/<[^>]*>/g, ""))}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAPER};padding:24px 12px;">
<tr><td align="center">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:${SHELL};border-radius:16px;overflow:hidden;border:1px solid ${MIST}66;">

    <tr><td style="background:${INK};padding:26px 32px;">
      <div style="font-size:19px;font-weight:300;letter-spacing:-0.01em;color:${CREAM};">Serene Pilates</div>
      <div style="margin-top:4px;font-size:11px;font-weight:500;letter-spacing:0.14em;text-transform:uppercase;color:${SAND};">Class schedule</div>
    </td></tr>

    <tr><td style="padding:32px;">
      <div style="font-size:28px;font-weight:300;letter-spacing:-0.02em;color:${INK};line-height:1.2;">${esc(month)}</div>
      <p style="margin:20px 0 0;font-size:15px;color:${INK};">Hi ${esc(firstName)},</p>
      <p style="margin:8px 0 0;font-size:15px;font-weight:300;line-height:1.6;color:${FERN};">${intro}</p>
      ${mineTable}

      ${
        relevant.length > 0
          ? `<div style="margin-top:32px;padding-top:24px;border-top:1px solid ${MIST}66;">
        <div style="font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:${SAGE};">Everyone's ${esc(
          categoryWord
        )} this month</div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:4px;">
          ${fullTimetable(periodStart, relevant)}
        </table>
      </div>`
          : ""
      }

      <p style="margin:28px 0 0;font-size:14px;font-weight:300;line-height:1.6;color:${FERN};">
        If something doesn't work for you, just reply to this email and we'll sort it out.
      </p>
    </td></tr>

    <tr><td style="background:${PAPER};padding:20px 32px;border-top:1px solid ${MIST}66;">
      <div style="font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:${FERN};margin-bottom:6px;">Studio hours</div>
      ${hours}
    </td></tr>

  </table>
</td></tr>
</table>
</body></html>`;

  const lines: string[] = [
    `Serene Pilates — ${month}`,
    "",
    `Hi ${firstName},`,
    "",
    count > 0
      ? `Here are your ${categoryWord} for ${month} — ${describeWorkload(classes)} in total.`
      : `You're not down for any ${categoryWord} in ${month} at the moment.`,
    "",
  ];
  for (const c of classes) {
    lines.push(
      `  ${formatDate(c.date)}  ${formatTime(c.start)}–${formatTime(c.end)}  ${c.format}${
        c.room ? ` (${c.room})` : ""
      }`
    );
  }
  lines.push("", "If something doesn't work for you, just reply to this email.");

  return { subject, html, text: lines.join("\n") };
}

/* --- Sending ------------------------------------------------------------- */

export type SendResult = {
  sent: string[];
  failed: { name: string; email: string; error: string }[];
};

/** Missing configuration, described in the words the owner needs to act on. */
export function emailConfigError(): string | null {
  if (!process.env.RESEND_API_KEY) {
    return "Email isn't set up yet — add RESEND_API_KEY to your environment (from resend.com) and restart the app.";
  }
  if (!process.env.SCHEDULE_FROM_EMAIL) {
    return "Email isn't set up yet — add SCHEDULE_FROM_EMAIL (e.g. \"Serene Pilates <schedule@serenepilates.ca>\") to your environment. The domain has to be verified in Resend first.";
  }
  return null;
}

export async function sendScheduleEmails({
  recipients,
  periodStart,
  allAssignments,
  formatCategories,
  includeEveryone = true,
}: {
  recipients: Recipient[];
  periodStart: string;
  allAssignments: ScheduleAssignment[];
  formatCategories: Map<string, Category>;
  includeEveryone?: boolean;
}): Promise<SendResult> {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const from = process.env.SCHEDULE_FROM_EMAIL as string;
  const replyTo = process.env.SCHEDULE_REPLY_TO?.trim() || undefined;

  const outcomes = await Promise.allSettled(
    recipients.map(async ({ instructor, classes }) => {
      const { subject, html, text } = renderScheduleEmail({
        instructor,
        classes,
        periodStart,
        allAssignments,
        formatCategories,
        includeEveryone,
      });

      const { error } = await resend.emails.send({
        from,
        to: instructor.email as string,
        replyTo,
        subject,
        html,
        text,
      });

      // The SDK reports delivery problems on `error` rather than throwing, so
      // a rejected address would otherwise look like a success.
      if (error) throw new Error(error.message ?? "Rejected by Resend");
      return instructor.name;
    })
  );

  const result: SendResult = { sent: [], failed: [] };
  outcomes.forEach((outcome, i) => {
    const { instructor } = recipients[i];
    if (outcome.status === "fulfilled") {
      result.sent.push(instructor.name);
    } else {
      result.failed.push({
        name: instructor.name,
        email: instructor.email ?? "",
        error:
          outcome.reason instanceof Error
            ? outcome.reason.message
            : "Failed to send",
      });
    }
  });

  return result;
}
