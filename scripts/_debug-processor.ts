import { AutoProcessor, RawImage } from "@huggingface/transformers";

async function main() {
  const processor: any = await AutoProcessor.from_pretrained("jinaai/jina-clip-v1");
  console.log("Processor:", processor.constructor.name);
  console.log("Components:", Object.keys(processor.components ?? {}));

  for (const k of Object.keys(processor.components ?? {})) {
    console.log("  -", k, ":", processor.components[k]?.constructor?.name);
  }

  const imgRes = await fetch(
    "https://tavfxeskxlqnfdzgfmnq.supabase.co/storage/v1/object/public/images/uploads/purple_dali-remote-work-deadline-dream_1775231417440.jpg"
  );
  const buf = Buffer.from(await imgRes.arrayBuffer());
  const img = await RawImage.fromBlob(new Blob([buf]));

  // Try calling with images kwarg
  console.log("\n--- Try processor({ images: img }) ---");
  try {
    const o = await processor({ images: img });
    console.log("keys:", Object.keys(o));
    for (const k of Object.keys(o)) console.log(" ", k, (o as any)[k]?.dims);
  } catch (e: any) {
    console.log("FAIL:", e.message);
  }

  console.log("\n--- Try image_processor component ---");
  try {
    const ip = processor.components?.image_processor ?? processor.image_processor;
    if (ip) {
      const o = await ip(img);
      console.log("keys:", Object.keys(o));
      for (const k of Object.keys(o)) console.log(" ", k, (o as any)[k]?.dims);
    } else {
      console.log("no image_processor component");
    }
  } catch (e: any) {
    console.log("FAIL:", e.message);
  }
}
main().catch(console.error);
