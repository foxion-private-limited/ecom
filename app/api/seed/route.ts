import { NextResponse } from "next/server";
import { clearAllDummyData } from "@/scripts/clear-dummy-data";
import { runSeed } from "@/scripts/seed";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action");

    if (action === "seed") {
      const result = await runSeed({ clearDummyData: true });
      return NextResponse.json(result);
    }

    // Default action: clear all dummy data
    const result = await clearAllDummyData();
    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Operation failed";
    console.error("Database seed API error:", message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action");

    if (action === "seed") {
      const result = await runSeed({ clearDummyData: true });
      return NextResponse.json(result);
    }

    // Default action: clear all dummy data
    const result = await clearAllDummyData();
    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Operation failed";
    console.error("Database seed API error:", message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    const result = await clearAllDummyData();
    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Operation failed";
    console.error("Database seed API error:", message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
