// ASCII-only slugs (slug column is VarChar). Arabic names must pass an explicit slug.
export const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120);
