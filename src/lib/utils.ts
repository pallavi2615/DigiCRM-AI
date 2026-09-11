import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Escape user-supplied text before interpolating it into PostgREST filter
 * strings (`.or(...)`, `.ilike(...)`). Characters like `,`, `.`, `(`, `)`,
 * `"` and `\` are PostgREST filter syntax and would otherwise let a user
 * alter the intended filter logic. LIKE wildcards are neutralised too.
 */
export function escapePostgrestFilterValue(input: string): string {
  return input
    .replace(/[\\%_]/g, (m) => `\\${m}`)
    .replace(/[,.()"'{}:*!]/g, " ")
    .trim();
}
