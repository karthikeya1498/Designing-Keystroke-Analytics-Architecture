import { NextResponse } from "next/server";
import { z } from "zod";
import { configuredCredentialsMatch, createSession, SESSION_COOKIE, sessionMaxAge } from "../../../utils/auth";

const loginSchema = z.object({
  username: z.string().trim().min(1).max(80),
  password: z.string().min(1).max(200),
}).strict();

export async function POST(request: Request) {
  try {
    const body = loginSchema.parse(await request.json());
    const isDemoLogin = process.env.NODE_ENV !== "production" && process.env.AEGISKEY_ALLOW_DEMO_INGEST === "true" && body.username === "demo" && body.password === "demo";
    if (!configuredCredentialsMatch(body.username, body.password) && !isDemoLogin) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const response = NextResponse.json({ authenticated: true }, { status: 200 });
    response.cookies.set({
      name: SESSION_COOKIE,
      value: createSession(body.username),
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: sessionMaxAge,
    });
    return response;
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) return NextResponse.json({ error: "Invalid login request" }, { status: 400 });
    console.error("Login failed", error);
    return NextResponse.json({ error: "Authentication is not configured" }, { status: 503 });
  }
}
