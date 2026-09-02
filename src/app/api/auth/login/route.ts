import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticateAccount } from "../../../../server/accountRepository";
import { createSession, SESSION_COOKIE, sessionMaxAge } from "../../../utils/auth";

const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(200),
}).strict();

export async function POST(request: Request) {
  try {
    const body = loginSchema.parse(await request.json());
    const account = await authenticateAccount(body.email.toLowerCase(), body.password);
    if (!account) return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });

    const response = NextResponse.json({ authenticated: true, email: account.email }, { status: 200 });
    response.cookies.set({
      name: SESSION_COOKIE,
      value: createSession(account.id, account.email),
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: sessionMaxAge,
    });
    return response;
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) return NextResponse.json({ error: "Enter a valid email and password" }, { status: 400 });
    console.error("Login failed", error);
    return NextResponse.json({ error: "Authentication is temporarily unavailable" }, { status: 503 });
  }
}
