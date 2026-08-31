/**
 * A format ("Reformer", "Concierge") belongs to a category. Classes are taught;
 * shifts are non-teaching cover like front desk.
 *
 * The category lives on the weekly template entry (`class_requirements.category`)
 * rather than on a separate formats table, so adding one is a one-column change.
 * A person's own record stays category-free on purpose: one team member has one
 * profile and one availability submission no matter what mix they cover, which
 * is the whole point of not splitting people into two lists.
 */

export const CATEGORIES = ["class", "shift"] as const;
export type Category = (typeof CATEGORIES)[number];

/** Anything created before categories existed is a class. */
export const DEFAULT_CATEGORY: Category = "class";

export const CATEGORY_LABEL: Record<Category, string> = {
  class: "Class",
  shift: "Shift",
};

export const CATEGORY_PLURAL: Record<Category, string> = {
  class: "Classes",
  shift: "Shifts",
};

/** Shown beside the picker so the owner knows which to choose. */
export const CATEGORY_HINT: Record<Category, string> = {
  class: "Taught on the timetable — Reformer, Mat, and so on.",
  shift: "Non-teaching cover — concierge, front desk, and so on.",
};

/** What the people who cover this category are called, in the team list. */
export const CATEGORY_TEAM_LABEL: Record<Category, string> = {
  class: "Teaching",
  shift: "Front of house",
};

export function isCategory(value: unknown): value is Category {
  return typeof value === "string" && (CATEGORIES as readonly string[]).includes(value);
}

export function toCategory(value: unknown): Category {
  return isCategory(value) ? value : DEFAULT_CATEGORY;
}

/** The filter state used by the template, draft and team views. */
export type CategoryFilter = "all" | Category;

/**
 * format name -> category, derived from the weekly template. A format nobody
 * has put on the template yet falls back to the default rather than vanishing
 * from a filtered view.
 */
export function categoryMap(
  requirements: { format: string; category?: string | null }[]
): Map<string, Category> {
  const map = new Map<string, Category>();
  for (const r of requirements) {
    if (r.format) map.set(r.format, toCategory(r.category));
  }
  return map;
}

export function categoryOf(
  map: Map<string, Category>,
  format: string
): Category {
  return map.get(format) ?? DEFAULT_CATEGORY;
}

/** Categories a person covers, given the formats on their profile. */
export function categoriesForFormats(
  map: Map<string, Category>,
  formats: string[]
): Set<Category> {
  return new Set(formats.map((f) => categoryOf(map, f)));
}
