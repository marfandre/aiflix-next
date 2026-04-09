import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const id = process.argv[2];
  if (!id) {
    console.error('Usage: tsx scripts/inspect-image.ts <id>');
    process.exit(1);
  }
  const { data, error } = await supa
    .from('images_meta')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) {
    console.error(error || 'not found');
    return;
  }

  console.log(`id: ${data.id}`);
  console.log(`path: ${data.path}`);
  console.log(`colors           (${(data.colors ?? []).length}): ${JSON.stringify(data.colors)}`);
  console.log(`color_weights    (${(data.color_weights ?? []).length}): ${JSON.stringify(data.color_weights)}`);
  console.log(`color_families   (${(data.color_families ?? []).length}): ${JSON.stringify(data.color_families)}`);
  console.log(`color_family_weights (${(data.color_family_weights ?? []).length}):`);
  for (const [i, fw] of (data.color_family_weights ?? []).entries()) {
    console.log(`  [${i}] ${JSON.stringify(fw)}`);
  }
  console.log(`color_positions  (${(data.color_positions ?? []).length}): ${JSON.stringify(data.color_positions)}`);
  console.log(`accent_colors    (${(data.accent_colors ?? []).length}): ${JSON.stringify(data.accent_colors)}`);
  console.log(`dominant_color : ${data.dominant_color}`);
  console.log(`secondary_color: ${data.secondary_color}`);
  console.log(`third_color    : ${data.third_color}`);
}

main();
