import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db/connection";
import { Party } from "@/lib/models/Party";
import { partySchema } from "@/lib/validations";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");

    await connectDB();
    const query: any = { isActive: true };
    if (type) query.type = type;

    const parties = await Party.find(query).sort({ name: 1 }).lean();
    return NextResponse.json(parties);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = partySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.format() },
        { status: 400 }
      );
    }

    await connectDB();

    const party = await Party.create(parsed.data);
    return NextResponse.json({ success: true, party });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
