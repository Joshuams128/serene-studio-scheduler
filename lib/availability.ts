// Pure helpers for time ranges ("09:00"–"12:00") on a single day. Used by the
// intake form, so picking a class from the timetable and editing exact hours
// are two views of the same data.

export type Range = { start: string; end: string };

/** True when the range fully contains [start, end]. */
export function covers(range: Range, start: string, end: string): boolean {
  return range.start <= start && range.end >= end;
}

/** Add [start, end] to a day's ranges, merging anything that overlaps or touches. */
export function addRange(ranges: Range[], start: string, end: string): Range[] {
  let merged: Range = { start, end };
  const rest: Range[] = [];
  for (const r of ranges) {
    if (r.end < merged.start || r.start > merged.end) rest.push(r);
    else
      merged = {
        start: r.start < merged.start ? r.start : merged.start,
        end: r.end > merged.end ? r.end : merged.end,
      };
  }
  return [...rest, merged].sort((a, b) => a.start.localeCompare(b.start));
}

/** Remove [start, end] from a day's ranges, splitting a range that spans it. */
export function subtractRange(ranges: Range[], start: string, end: string): Range[] {
  const out: Range[] = [];
  for (const r of ranges) {
    if (r.end <= start || r.start >= end) {
      out.push(r);
      continue;
    }
    if (r.start < start) out.push({ start: r.start, end: start });
    if (r.end > end) out.push({ start: end, end: r.end });
  }
  return out;
}
