import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const s = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
    const { data, error } = await s
        .from('images_meta')
        .select('colors, color_names, color_families, color_weights')
        .eq('id', '20a11c34-62ff-4074-b7af-e9680f135d0f')
        .single();

    if (error) console.error('ERR:', error.message);
    else console.log(JSON.stringify(data, null, 2));
}

main();
