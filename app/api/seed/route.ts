import { NextResponse } from "next/server";
import { runSeed } from "@/scripts/seed";

export async function POST() {
  try {
    const result = await runSeed();
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Seed API error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to seed database" },
      { status: 500 }
    );
  }
}
