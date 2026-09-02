import { NextResponse } from "next/server";
import { z } from "zod";
import { createAccount, isUniqueViolation, validatePasswordPolicy } from "../../../../server/accountRepository";

const registerSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(12).max(200),
}).strict();

export async function POST(request: Request) {
  try {
    const body = registerSchema.parse(await request.json());
    if (!validatePasswordPolicy(body.password)) {
      return NextResponse.json({ error: "Password must be 12-200 characters and include uppercase, lowercase, and a number" }, { status: 422 });
    }
    const account = await createAccount(body.email.toLowerCase(), body.password);
    return NextResponse.json({ registered: true, email: account.email }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) return NextResponse.json({ error: "Enter a valid email and password" }, { status: 400 });
    if (isUniqueViolation(error)) return NextResponse.json({ error: "An account with that email already exists" }, { status: 409 });
    console.error("Registration failed", error);
    return NextResponse.json({ error: "Registration is temporarily unavailable" }, { status: 503 });
  }
}
