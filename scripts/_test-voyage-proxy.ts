import { config } from "dotenv";
config({ path: ".env.local" });

import sharp from "sharp";
import { getImageEmbeddingFromBuffer } from "../lib/voyageEmbedding";

async function run() {
  const imgRes = await fetch(
    "https://tavfxeskxlqnfdzgfmnq.supabase.co/storage/v1/object/public/images/uploads/purple_dali-remote-work-deadline-dream_1775231417440.jpg"
  );
  const original = Buffer.from(await imgRes.arrayBuffer());

  // Test 1: JPEG 400px
  const jpeg = await sharp(original).resize(400).jpeg({ quality: 80 }).toBuffer();
  console.log(`\n[JPEG 400px] ${jpeg.length} bytes`);
  const e1 = await getImageEmbeddingFromBuffer(jpeg, "image/jpeg");
  console.log(" →", e1 ? "OK" : "FAIL");

  // Test 2: PNG 400px
  const png = await sharp(original).resize(400).png().toBuffer();
  console.log(`\n[PNG 400px] ${png.length} bytes`);
  const e2 = await getImageEmbeddingFromBuffer(png, "image/png");
  console.log(" →", e2 ? "OK" : "FAIL");

  // Test 3: JPEG 100px tiny
  const tinyJpeg = await sharp(original).resize(50).jpeg({ quality: 50 }).toBuffer();
  console.log(`\n[JPEG 50px] ${tinyJpeg.length} bytes`);
  const e3 = await getImageEmbeddingFromBuffer(tinyJpeg, "image/jpeg");
  console.log(" →", e3 ? "OK" : "FAIL");

  // Test 4: PNG 10px
  const tinyPng = await sharp(original).resize(10).png().toBuffer();
  console.log(`\n[PNG 10px] ${tinyPng.length} bytes`);
  const e4 = await getImageEmbeddingFromBuffer(tinyPng, "image/png");
  console.log(" →", e4 ? "OK" : "FAIL");
}

run().catch(console.error);
