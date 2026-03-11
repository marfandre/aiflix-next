// app/api/tags/generate/route.ts
import { NextResponse } from "next/server";
import { generateAITagsFromFile } from "@/lib/autoTagger";

export const runtime = "nodejs";

export async function POST(req: Request) {
    try {
        const formData = await req.formData();
        const file = formData.get("file") as File;

        if (!file) {
            return NextResponse.json({ error: "File required" }, { status: 400 });
        }

        const tags = await generateAITagsFromFile(file);
        return NextResponse.json({ tags });
    } catch (err: any) {
        console.error("Tags generation API error:", err);
        return NextResponse.json({ tags: [] }); // Graceful fallback
    }
}
