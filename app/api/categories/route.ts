import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db/connection";
import { Category } from "@/lib/models/Category";
import { categorySchema } from "@/lib/validations";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");

    await connectDB();
    const query: any = { isActive: true };
    if (type) query.type = type;

    const categories = await Category.find(query).sort({ name: 1 }).lean();
    return NextResponse.json(categories);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = categorySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.format() },
        { status: 400 }
      );
    }

    await connectDB();

    const slug = parsed.data.name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-");

    const existing = await Category.findOne({
      name: { $regex: new RegExp(`^${parsed.data.name.trim()}$`, "i") },
      type: parsed.data.type,
    });

    if (existing) {
      return NextResponse.json(
        { error: "A category with this name already exists" },
        { status: 400 }
      );
    }

    const category = await Category.create({
      ...parsed.data,
      slug,
    });

    return NextResponse.json({ success: true, category });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
