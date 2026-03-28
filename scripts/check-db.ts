import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

async function main() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const id = process.argv[2];
  if (!id) { console.error('Usage: npx tsx scripts/check-db.ts <image-id>'); process.exit(1); }
  const { data, error } = await sb.from('images_meta').select('id, title, colors, accent_colors, color_positions').eq('id', id).single();
  if (error) console.error('ERROR:', error);
  else console.log(JSON.stringify(data, null, 2));
}
main();
