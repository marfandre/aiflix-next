import { config } from "dotenv";
config({ path: ".env.local" });

import { getTextEmbedding, getImageEmbedding, LOCAL_EMBEDDING_DIMS } from "../lib/localEmbedding";

async function main() {
  console.log("Expected dims:", LOCAL_EMBEDDING_DIMS);

  console.log("\n[1/2] Text embedding (first run will download model)...");
  const t0 = Date.now();
  const textEmb = await getTextEmbedding("red sunset over the ocean");
  console.log(`  ${textEmb ? `OK ${textEmb.length} dims` : "FAIL"} in ${Date.now() - t0}ms`);
  if (textEmb) console.log(`  first 5: ${textEmb.slice(0, 5).join(", ")}`);

  console.log("\n[2/2] Image embedding from Supabase...");
  const t1 = Date.now();
  const imgEmb = await getImageEmbedding(
    "https://tavfxeskxlqnfdzgfmnq.supabase.co/storage/v1/object/public/images/uploads/purple_dali-remote-work-deadline-dream_1775231417440.jpg"
  );
  console.log(`  ${imgEmb ? `OK ${imgEmb.length} dims` : "FAIL"} in ${Date.now() - t1}ms`);
  if (imgEmb) console.log(`  first 5: ${imgEmb.slice(0, 5).join(", ")}`);
}

main().catch(console.error);
