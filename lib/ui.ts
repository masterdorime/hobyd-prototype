// lib/ui.ts — tiny classnames helper (shadcn-style cn without extra deps).
export function cn(
  ...parts: Array<string | false | null | undefined>
): string {
  return parts.filter((p) => typeof p === "string" && p.length > 0).join(" ");
}
