import { createHmac, timingSafeEqual } from "crypto";

/** Payload embedded in a signed role-PDF link. */
export interface RolePdfClaims {
  role: string;
  uid: string;
  exp: number; // epoch seconds
}

function secret(): string {
  const value = process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? process.env['SUPABASE_DB_URL'];
  if (!value) throw new Error("Signing secret unavailable");
  return value;
}

function canonical(claims: RolePdfClaims): string {
  return `${claims.role}.${claims.uid}.${claims.exp}`;
}

export function signRolePdfClaims(claims: RolePdfClaims): string {
  return createHmac("sha256", secret()).update(canonical(claims)).digest("hex");
}

/** Constant-time signature + expiry verification. */
export function verifyRolePdfClaims(claims: RolePdfClaims, signature: string): boolean {
  if (!Number.isFinite(claims.exp) || claims.exp * 1000 < Date.now()) return false;
  const expected = signRolePdfClaims(claims);
  const a = Buffer.from(signature ?? "", "utf8");
  const b = Buffer.from(expected, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}
