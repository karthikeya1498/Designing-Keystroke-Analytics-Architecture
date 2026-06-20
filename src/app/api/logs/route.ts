import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

// Save logs in the project root directory as a JSON-Lines file
const LOG_FILE_PATH = path.join(process.cwd(), "keystroke_logs.jsonl");

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { events } = body;

    if (!events || !Array.isArray(events)) {
      return NextResponse.json({ error: "Invalid payload format. Expected 'events' array." }, { status: 400 });
    }

    // Append each keystroke event as a separate line in the JSONL file
    for (const event of events) {
      const line = JSON.stringify(event) + "\n";
      await fs.promises.appendFile(LOG_FILE_PATH, line, "utf-8");
    }

    return NextResponse.json({ success: true, savedCount: events.length });
  } catch (error: any) {
    console.error("Failed to append keystrokes to file:", error);
    return NextResponse.json({ error: "Write failed: " + error.message }, { status: 500 });
  }
}

export async function GET() {
  try {
    if (!fs.existsSync(LOG_FILE_PATH)) {
      return NextResponse.json({ events: [] });
    }

    const fileContent = await fs.promises.readFile(LOG_FILE_PATH, "utf-8");
    const lines = fileContent.trim().split("\n").filter(Boolean);
    const events = lines.map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    }).filter(Boolean);

    return NextResponse.json({ events, rawContent: fileContent });
  } catch (error: any) {
    console.error("Failed to read keystroke logs file:", error);
    return NextResponse.json({ error: "Read failed: " + error.message }, { status: 500 });
  }
}
