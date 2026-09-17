import { NextResponse } from "next/server";
import { saveBillDocument, getBills } from "@/lib/storage/billStorage";
import { getCurrentUser } from "@/lib/auth/session";

export async function GET() {
  try {
    const bills = await getBills(50);
    return NextResponse.json(bills);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const category = (formData.get("category") as string) || undefined;
    const relatedType = (formData.get("relatedType") as any) || undefined;
    const relatedId = (formData.get("relatedId") as string) || undefined;

    if (!file) {
      return NextResponse.json(
        { error: "No document file provided" },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);

    const bill = await saveBillDocument({
      fileBuffer,
      originalName: file.name,
      mimeType: file.type,
      category,
      relatedType,
      relatedId,
      uploadedBy: user?.email || "System",
    });

    return NextResponse.json({ success: true, bill });
  } catch (error: any) {
    console.error("Bill upload error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to upload document" },
      { status: 500 }
    );
  }
}
