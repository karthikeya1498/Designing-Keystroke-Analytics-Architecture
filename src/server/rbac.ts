import { NextResponse } from "next/server";
import { getAccountRole, type AccountRole } from "./accountRepository";
import { getSessionUsernameFromCookieHeader } from "../app/utils/auth";

export interface AuthorizedPrincipal {
  email: string;
  role: AccountRole;
}

/** Author: Karthikeya. Every analyst/admin route uses this single policy boundary. */
export async function requireRole(request: Request, allowed: readonly AccountRole[]): Promise<AuthorizedPrincipal | NextResponse> {
  const email = getSessionUsernameFromCookieHeader(request.headers.get("cookie"));
  if (!email) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const role = await getAccountRole(email);
  if (!role || !allowed.includes(role)) return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  return { email, role };
}

export function isPrincipal(value: AuthorizedPrincipal | NextResponse): value is AuthorizedPrincipal {
  return "email" in value && "role" in value;
}
