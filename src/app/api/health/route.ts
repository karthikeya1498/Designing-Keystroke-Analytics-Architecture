import { NextResponse } from "next/server";
import { checkPostgresHealth } from "../../../server/storage/PostgresStorage";

/** Author: Karthikeya. Readiness is explicit so orchestration can fail closed. */
export async function GET() {
  const databaseConfigured = Boolean(process.env.DATABASE_URL);
  const databaseHealthy = databaseConfigured ? await checkPostgresHealth() : false;
  const dependencies = {
    postgres: databaseHealthy ? "healthy" : databaseConfigured ? "unhealthy" : "unconfigured",
    redis: process.env.REDIS_URL ? "configured" : "unconfigured",
    mlService: process.env.ML_SERVICE_URL ? "configured" : "unconfigured",
  } as const;
  const ready = databaseHealthy;
  return NextResponse.json({ status: ready ? "ok" : "degraded", ready, service: "aegiskey-web", dependencies }, { status: ready ? 200 : 503 });
}
