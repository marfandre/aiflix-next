// scripts/batch-generate.ts
// Batch generation: read prompt pairs -> generate via fal.ai -> upload to platform
// Usage: npx tsx scripts/batch-generate.ts [--start 0] [--count 50] [--dry-run]

import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import prompts from './purple-prompts.json';

// Per-image environment contexts for more natural, less sterile look
const ENVIRONMENT_CONTEXTS: Record<number, string> = {
    8: "resting on a dusty wooden table in a dimly lit apothecary, scattered dried herbs around, warm candlelight reflections",
    9: "standing on a cracked marble counter in an old wine cellar, cobwebs catching faint light, aged wooden barrels behind",
    36: "growing from a crack in a weathered stone wall, morning dew on surrounding moss, soft fog in the background",
    37: "viewed from a shadowy corridor with worn stone floor tiles, dust particles floating in light beams, ancient atmosphere",
    38: "in a dark sculptor studio, clay-stained workbench underneath, scattered tools and fabric, single overhead light source",
    39: "stretching across a misty ravine between ancient cliff faces, faint rain falling, wet rocks glistening below, moonlight breaking through storm clouds above",
    40: "standing on a snow-dusted granite ledge overlooking a frozen valley at twilight, pine trees in soft focus behind, breath-like mist curling around its paws",
    41: "suspended in a deep ocean cavern with bioluminescent algae on the rock walls, shafts of pale light filtering from a crack in the ceiling above, tiny bubbles rising",
    42: "perched on a gnarled oak branch in a fog-heavy ancient forest, lichen and ivy climbing the trunk, scattered fallen leaves on the mossy ground below, overcast sky",
    43: "emerging from a bed of dark volcanic rock in a hidden grotto, mineral-rich water pooling around the base, stalactites dripping overhead, faint steam rising",
    44: "crouched on a frost-covered fallen log in a deep winter forest at golden hour, snow drifts around, bare birch trees fading into amber fog, tiny ice crystals sparkling on its fur",
    48: "prowling along a rain-slicked cobblestone alley in a forgotten European quarter at night, warm light spilling from a cracked doorway, puddles reflecting neon violet signs above, wet ivy on old brick walls",
    45: "standing in a moonlit clearing of an ancient pine forest, silver mist swirling at its hooves, ferns and wild violets carpeting the ground, distant mountains under a star-filled sky",
    46: "drifting near a sunken coral arch in a deep tropical lagoon, shafts of sunlight piercing the turquoise water, sea anemones and barnacles on the surrounding rocks, tiny silver fish schooling nearby",
    47: "resting on the petal of a giant water lily in a still jungle pond at dawn, morning mist hovering over the surface, dragonflies nearby, lush tropical foliage reflected in the dark water",
    49: "rooted in the mossy floor of a ruined cathedral overtaken by nature, broken stained glass windows filtering colored light, ivy climbing stone pillars, rain puddles on the ancient tiles around it",
};

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const FAL_KEY = process.env.FAL_KEY!;
const IMPORT_USER_ID = process.env.IMPORT_USER_ID!;

// --- Model distribution: 70% flux-dev, 15% flux-pro, 15% banana ---
type ModelConfig = {
    endpoint: string;
    name: string;
};

const MODELS: { config: ModelConfig; weight: number }[] = [
    { config: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' }, weight: 0.70 },
    { config: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' }, weight: 0.15 },
    { config: { endpoint: 'fal-ai/flux/schnell', name: 'flux/schnell' }, weight: 0.15 },
];

// --- Image sizes: varied ---
const IMAGE_SIZES = [
    'square_hd',       // 1024x1024
    'landscape_4_3',   // 1184x880
    'portrait_4_3',    // 880x1184
    'portrait_16_9',   // 768x1344
];

// Deterministic model assignment based on index
// Per-index model overrides
const MODEL_OVERRIDES: Record<number, ModelConfig> = {
    44: { endpoint: 'fal-ai/nano-banana', name: 'nano-banana' },
    48: { endpoint: 'fal-ai/nano-banana', name: 'nano-banana' },
    50: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },
    51: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },
    52: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },
    53: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },
    54: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },
    55: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },
    56: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },
    57: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },
    58: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },
    59: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },
    60: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },
    61: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },
    62: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },
    63: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },
    64: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },
    65: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },
    66: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },
    67: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },
    68: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },
    69: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },
    70: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },
    71: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },
    72: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },
    73: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },
    74: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },
    75: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },
    // 8.1-8.15 (indices 76-90): flux/dev
    76: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },
    77: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },
    78: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },
    79: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },
    80: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },
    81: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },
    82: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },
    83: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },
    84: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },
    85: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },
    86: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },
    87: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },
    88: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },
    89: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },
    90: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },
    // 8.16-8.22 (indices 91-97): flux-pro
    91: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' },
    92: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' },
    93: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' },
    94: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' },
    95: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' },
    96: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' },
    97: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' },
    // 8.23-8.30 (indices 98-105): nano-banana
    98: { endpoint: 'fal-ai/nano-banana', name: 'nano-banana' },
    99: { endpoint: 'fal-ai/nano-banana', name: 'nano-banana' },
    100: { endpoint: 'fal-ai/nano-banana', name: 'nano-banana' },
    101: { endpoint: 'fal-ai/nano-banana', name: 'nano-banana' },
    102: { endpoint: 'fal-ai/nano-banana', name: 'nano-banana' },
    103: { endpoint: 'fal-ai/nano-banana', name: 'nano-banana' },
    104: { endpoint: 'fal-ai/nano-banana', name: 'nano-banana' },
    105: { endpoint: 'fal-ai/nano-banana', name: 'nano-banana' },
    // 9.1-9.5 (indices 106-110): flux/dev
    106: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },
    107: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },
    108: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },
    109: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },
    110: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },
    // 9.6-9.8 (indices 111-113): flux-pro
    111: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' },
    112: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' },
    113: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' },
    // 9.9-9.10 (indices 114-115): nano-banana
    114: { endpoint: 'fal-ai/nano-banana', name: 'nano-banana' },
    115: { endpoint: 'fal-ai/nano-banana', name: 'nano-banana' },
    // 10.1-10.10 (indices 116-125): flux/dev
    116: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },
    117: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },
    118: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },
    119: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },
    120: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },
    121: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },
    122: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },
    123: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },
    124: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },
    125: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },
    // 10.6-10.16 (indices 121-131): flux/dev
    // 121-125 already set above
    126: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },
    127: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },
    128: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },
    129: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },
    130: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },
    131: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },
    // 10.17-10.18 (indices 132-133): flux-pro
    132: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' },
    133: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' },
    // 10.19-10.20 (indices 134-135): nano-banana
    134: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },
    135: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },
    // 11.1 (index 136): flux/dev
    136: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },
    // 11.2-11.3 (indices 137-138): flux/dev
    137: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },
    138: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },
    // 12.1-12.10 (indices 139-148): red series, all flux/dev
    139: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },
    140: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },
    141: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },
    142: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },
    143: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },
    144: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },
    145: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },
    146: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },
    147: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },
    148: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },
    // 13.1-13.14 (indices 149-162): red series pt2, all flux/dev
    149: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },
    150: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },
    151: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },
    152: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },
    153: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },
    154: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },
    155: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },
    156: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },
    157: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },
    158: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },
    159: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },
    160: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },
    161: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },
    162: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },
    // 14.1-14.10 (indices 163-172): impossible red, mixed flux/dev + flux-pro
    163: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },
    164: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' },
    165: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },
    166: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },
    167: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' },
    168: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },
    169: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },
    170: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' },
    171: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },
    172: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },
    173: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },
    174: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },
    175: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },
    176: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },
    177: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },
    178: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },
    // 15.1-15.2 (indices 179-180): green series, flux/dev
    179: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },
    180: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },
    // 15.3-15.7 (indices 181-185): green series pt2, flux/dev
    181: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },
    182: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },
    183: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },
    184: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },
    185: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },
    186: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },
    // 16.1-16.15 (indices 187-201): green series additional, mixed models
    187: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Alarm Clock Orchard
    188: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' },  // Microwave Weather Chamber
    189: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Laptop Root Atlas
    190: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' },  // Ceiling Fan of Hanging Lakes
    191: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Dishwasher Rainforest Racks
    192: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Bus Stop Ticket Vines
    193: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Window AC Fog Cathedral
    194: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' },  // Laundromat Tidal Forest
    195: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Street Drain Observatory
    196: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' },  // Toaster of Glass Ferns
    197: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Checkout Belt Wetland
    198: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Mail Slot Canal
    199: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Umbrella Stand Waterfall
    200: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' },  // Bathroom Mirror Glitch Garden
    201: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Coffee Grinder Planetarium
    202: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' }, // Victorian Greenhouse Interior
    203: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' }, // Malachite Chamber
    204: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Scottish Highlands in Rain
    205: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' }, // Absinthe Still Life
    206: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Jade Emperor's Garden
    207: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' }, // Elevator Emerald Swamp
    208: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' }, // Malachite Bedroom Geode
    209: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Grand Piano Consumed by Ivy
    210: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Aquarium Wall Apartment
    211: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' }, // Umbrella Leaf Rain
    212: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' }, // Kitchen Sunset Pot
    213: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Dress of Red Smoke
    214: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Elevator Full of Red Roses
    215: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' }, // Living Heart Wallpaper Room
    216: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Red Library Flooding
    217: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Taxi in Sunflower Field
    218: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' }, // Light Bulb City
    219: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Lemon Rain on Subway
    220: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' }, // Honeycomb Bed
    221: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Golden Moss Stairwell
    222: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' }, // Bedroom in Deep Space
    223: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Library Flooded with Indigo Ink
    224: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' }, // Door to the Deep Ocean
    225: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Pianist Underwater
    226: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' }, // Midnight Watchmaker Workshop
    227: { endpoint: 'fal-ai/nano-banana', name: 'nano-banana' }, // Autumn Tree Growing from Grand Piano
    228: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Honey Faucet Bathroom
    229: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' }, // Burning Book Staircase
    230: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Orange Grove Inside a Cathedral
    231: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' }, // Spilled Sunset on Kitchen Table
    232: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' }, // Cinema Portal Screen
    233: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Neon Magenta Bathtub
    234: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Tree of Magenta Lightning
    235: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' }, // Magenta Monochrome Supermarket
    236: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Magenta Lava Fountain
    237: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' }, // Strawberry Ice Cream Grand Piano
    238: { endpoint: 'fal-ai/nano-banana', name: 'nano-banana' }, // Marshmallow Sneakers
    239: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Cotton Candy Bedroom Pillows
    240: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' }, // Whipped Cream Bathtub
    241: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Lollipop Crystal Chandelier
    242: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' }, // Book Swimming Pool
    243: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Turquoise Jelly Armchair
    244: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' }, // Teapot Waterfall
    245: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Subway Stairs Into Turquoise Water
    246: { endpoint: 'fal-ai/nano-banana', name: 'nano-banana' }, // Jellyfish Shower
    247: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' }, // Chocolate Laptop
    248: { endpoint: 'fal-ai/nano-banana', name: 'nano-banana' }, // Peanut Butter Armchair
    249: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' }, // Caramel Glass Violin
    250: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Cookie Library
    251: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Chocolate Waterfall Staircase
    252: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' }, // Suitcase Lavender Field
    253: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Galaxy Ice Cream Cone
    254: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' }, // Wisteria Street Lamp
    255: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Umbrella Petal Rain
    256: { endpoint: 'fal-ai/nano-banana', name: 'nano-banana' }, // Grape Juice Faucet
    257: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Moss-Covered Alarm Clock
    258: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' }, // Forest Inside a Refrigerator
    259: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Earbuds Growing Lime Vines
    260: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' }, // Living Grass Sneakers
    261: { endpoint: 'fal-ai/nano-banana', name: 'nano-banana' }, // Matcha Bathtub
    262: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' }, // Ocean in a Glass
    263: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Turquoise Roe Armchair
    264: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' }, // Mirror Reflecting Underwater Reef
    265: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Turquoise Sea Sponge Pillow
    266: { endpoint: 'fal-ai/nano-banana', name: 'nano-banana' }, // Jellyfish Umbrella
    // 28.1-28.5 Orange (267-271)
    267: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' }, // Salmon Office Chair
    268: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Pizza Moon Over City
    269: { endpoint: 'fal-ai/nano-banana', name: 'nano-banana' }, // Bread Loaf Sofa
    270: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' }, // Melted Cheese Door Handle
    271: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // City Inside an Orange
    // 28.6-28.10 Magenta (272-276)
    272: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' }, // TV Portal Wisteria
    273: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Jellyfish Dress on Subway
    274: { endpoint: 'fal-ai/nano-banana', name: 'nano-banana' }, // Gemstone Rubik's Cube
    275: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' }, // Amethyst Geode Bathtub
    276: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Wardrobe Violet Thunderstorm
    // 28.11-28.15 Lime (277-281)
    277: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Moss-Covered Office Laptop
    278: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' }, // Sushi Roll Park
    279: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Abandoned Car Forest
    280: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' }, // Headphones Swamp
    281: { endpoint: 'fal-ai/nano-banana', name: 'nano-banana' }, // Outlet Growing Ivy
    282: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' }, // Coffee Volcanic Island
    283: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Walnut Victorian Study
    284: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' }, // Avocado Swimming Pool
    285: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Watermelon Football Stadium
    286: { endpoint: 'fal-ai/nano-banana', name: 'nano-banana' }, // Soft-Boiled Egg Golden Temple
    287: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' }, // Snow Globe Living City
    288: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Violin Honeycomb Cross-Section
    // 30.1-30.14 (289-302): Food, Crystals, Art Portraits, Folk Art
    289: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' }, // Croissant Dress Shoes
    290: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' }, // Red Caviar Armchair
    291: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // White Chocolate Bathtub
    292: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Gummy Bear Chandelier
    293: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' }, // Rose Quartz Grand Piano
    294: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Obsidian Sneakers
    295: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' }, // Amber Violin with Prehistoric Insects
    296: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' }, // Gold Leaf and Indigo Face
    297: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Turquoise Tile Mosaic Face
    298: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' }, // Molten Gold Face
    299: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Peony Face
    300: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Blue Whale in Night Sky Folk Art
    301: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' }, // Fox in Autumn Forest Folk Art
    302: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Peacock Persian Folk Art
    // 31.1-31.6 (303-308): Orange Miniature Worlds
    303: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Mandarin Japanese Zen Garden
    304: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' }, // Pumpkin Cozy Library
    305: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Apricot Roman Bath
    306: { endpoint: 'fal-ai/nano-banana', name: 'nano-banana' }, // Persimmon Sunset Lighthouse
    307: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' }, // Butterscotch Candy Confectionery
    308: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Grapefruit Amphitheater
    // 31.7-31.11 (309-313): Orange Food Furniture
    309: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' }, // Croissant Armchair
    310: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Caramel Candy Floor Lamp
    311: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Waffle Bookshelves with Syrup
    312: { endpoint: 'fal-ai/nano-banana', name: 'nano-banana' }, // Ripe Mango Sofa
    313: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' }, // Burnt Caramel Guitar
    // 32.1-32.3 (314-316): Art Masters × Future City
    314: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' }, // Monet Cyberpunk Sunset City
    315: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Picasso Cubist Metropolis
    316: { endpoint: 'fal-ai/nano-banana', name: 'nano-banana' }, // Dali Surrealist Future City
    // 32.4-32.6 (317-319): Art Masters × Future City pt2
    317: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Van Gogh Neon Metropolis Night
    318: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' }, // Degas Urban Rooftop Dancers
    319: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Klimt Golden Digital Age
    // 32.7-32.8 (320-321): Art Masters × Future City pt3
    320: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' }, // Hokusai Digital Wave Megacity
    321: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Matisse Simplified City Paradise
    // 32.9-32.10 (322-323): Art Masters × City pt4
    322: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' }, // Kandinsky Abstract City
    323: { endpoint: 'fal-ai/nano-banana', name: 'nano-banana' }, // Mucha Art Nouveau Cyberspace
    // 33.1-33.4 (324-327): Orange Gemstone Artifacts
    324: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' }, // Carnelian and Amber Crown
    325: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Amber vs Obsidian Chess Set
    326: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Fire Opal Vase
    327: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' }, // Amber Skull with Prehistoric Insects
    // 33.5-33.7 (328-330): Orange Face Portraits
    328: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' }, // Liquid Caramel Face
    329: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Burnt Orange Geometric Face Art
    330: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Amber Mask with Ancient Insects
    // 33.8-33.10 (331-333): Mechanical Copper Animals
    331: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Mechanical Copper Butterfly
    332: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' }, // Mechanical Bronze Fox
    333: { endpoint: 'fal-ai/nano-banana', name: 'nano-banana' }, // Rose Gold Cyborg Hummingbird
    // 33.11-33.12 (334-335): Orange Sculptures
    334: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' }, // Amber Glass Cupid Sculpture
    335: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Apollo Bust Orange Collage
    // 33.13-33.14 (336-337): Orange Folk Art Animals
    336: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' }, // Tiger Rajasthani Miniature
    337: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Kitsune Fox Spirit Ukiyo-e
    // 32.11-32.14 (338-341): Art Masters pt5
    338: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Rembrandt Selfie in Mirror
    339: { endpoint: 'fal-ai/nano-banana', name: 'nano-banana' }, // Bosch International Airport
    340: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' }, // Vermeer Coffee Shop Golden Age
    341: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // El Greco Metropolis Vision
    // 33.15-33.17 (342-344): Orange Artifacts
    342: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' }, // Autumn Forest Violin
    343: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Firebird Samovar Palekh Art
    344: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Samurai Gourd Kintsugi Helmet
    // 32.15-32.19 (345-349): Art Masters × Modern Life
    345: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' }, // Degas Fitness Studio
    346: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Cezanne Supermarket Still Life
    347: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Picasso Blue Period Phone Loneliness
    348: { endpoint: 'fal-ai/nano-banana', name: 'nano-banana' }, // Malevich Digital Void Smartphone
    349: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' }, // Chagall VR Flight Over City
    // 32.20-32.24 (350-354): Art Memes & Fun
    350: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Kandinsky QR Code Composition
    351: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' }, // Rembrandt Surprised Cat Portrait
    352: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Dali Remote Work Deadline Dream
    353: { endpoint: 'fal-ai/nano-banana', name: 'nano-banana' }, // Ancient Egypt Pizza Delivery Fresco
    354: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' }, // Cave Paintings with Smartphones
    // 32.25-32.26 (355-356): Art Memes pt2
    355: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Rubens Goddess Pizza Delivery
    356: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Art Deco 1920s Drone City
    // 34.1-34.5 (357-361): Cinematic Fantasy
    357: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' }, // Mirror Armor Knight in Cathedral
    358: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Leviathan Rising from the Abyss
    359: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' }, // Porcelain Android Geisha Kintsugi
    360: { endpoint: 'fal-ai/nano-banana', name: 'nano-banana' }, // Sunken Baroque Ballroom Underwater
    361: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Half Mechanical Heart on Surgical Tray
    // 34.6-34.10 (362-366): Cinematic Mixed
    362: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' }, // Masked Figure in Gothic Chamber
    363: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Macro Lips with Art Manicure
    364: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' }, // Mosque in Pastel Watercolor Clouds
    365: { endpoint: 'fal-ai/nano-banana', name: 'nano-banana' }, // Pirate Ship and Giant Orange Moon
    366: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Painting Comes Alive Ocean Flood Studio
    // 35.1-35.17 (367-383): Orange Gothic & Surreal
    367: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' }, // Gothic Cathedral of Burnt Orange Stone
    368: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Cloister Library Flying Manuscripts
    369: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Gothic Bell Tower Mandarin Storm Bells
    370: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' }, // Monastic Hall Liquid Apricot Light
    371: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Ruined Abbey Citrus Gargoyle Lanterns
    372: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Gothic Crypt Mandarin Halos
    373: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' }, // Gothic Organ Apricot Wax Pipes
    374: { endpoint: 'fal-ai/nano-banana', name: 'nano-banana' }, // Medieval Street Breathing Orange Banners
    375: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Chapel of Mirrors Orange Seasons
    376: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' }, // Gothic Bridge of Orange Candle Wax
    377: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Mechanical Heron on Rooftop Tower
    378: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Living Radiator Coral Reef
    379: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' }, // Desert City Inside Traffic Light
    380: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Mandarin Paper Escalator Metro
    381: { endpoint: 'fal-ai/nano-banana', name: 'nano-banana' }, // Laundromat Dryers Orange Weather
    382: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Subway Statue Holographic Dissolution
    383: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Office Stairwell of Solid Apricot Light
    // 35.18-35.20 (384-386): Orange Surreal pt2
    384: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' }, // Teapot Canyon Pocket Universe
    385: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Bus Cross Section Monastery Garden
    386: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Sacred Phone Booth Mandarin Relic
    387: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' }, // Angel Statue Drowning in Copper Sand
    388: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Baroque Palace Lost in Desert Sand
    389: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' }, // Demonic Gothic Battlefield Painkiller
    390: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Warrior in Ruined Blue Monastery
    391: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' }, // Gothic Cathedral City in Midnight Blue
    392: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Cursed Swamp Cathedral Sinking
    393: { endpoint: 'fal-ai/nano-banana', name: 'nano-banana' }, // Haunted Monastery in Poisoned Marsh
    // 36.1-36.13 (394-406): Mixed Art & Photography
    394: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Felt Doll with Lavender
    395: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' }, // Intimate Portrait of Two Faces
    396: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Butterfly in Mixed Media Collage
    397: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Fish Red Linocut Print
    398: { endpoint: 'fal-ai/nano-banana', name: 'nano-banana' }, // Black Cat on Yellow Background
    399: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Crane and Pine Chinese Ink Painting
    400: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' }, // Owl in Neon Blue Macro
    401: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Cozy European Cafe Street
    402: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // White and Pink Magnolia Flowers
    403: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' }, // Giant Stone Faces in Desert Canyon
    404: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Product Photography with Flowers
    405: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Red Tulip Bud Emerging from Soil
    406: { endpoint: 'fal-ai/nano-banana', name: 'nano-banana' }, // Fashion Poster with Typography
    // 37.1-37.20 (407-426): Orange-Led Flux Series
    407: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Apricot Station Clock
    408: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' }, // Velvet Canyon
    409: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Mandarin Prism Stairwell
    410: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // The Reliquary Telephone
    411: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' }, // Ballroom Chandelier Collapse
    412: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Excavated Transit Helmet
    413: { endpoint: 'fal-ai/nano-banana', name: 'nano-banana' }, // Mandarin Courtyard Echo
    414: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Sunprint Quarry
    415: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' }, // Citrus Glass Still Life
    416: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Room of Restless Warmth
    417: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Orchard Terminal
    418: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' }, // Bird from Copper Lines
    419: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Peeling Opera Walls
    420: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Desert Eclipse Ring
    421: { endpoint: 'fal-ai/nano-banana', name: 'nano-banana' }, // Citrus Observatory
    422: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' }, // Mandarin Monolith
    423: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Dawn Fox of Vapor
    424: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Suspended Resin Arch
    425: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' }, // Terracotta Piano Bloom
    426: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // The Apricot Lighthouse
    // 38.1-38.10 (427-436): Refined Orange Peach Series
    427: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Peach Fog Escalator
    428: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' }, // Piano with Autumn Core
    429: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Hall of Sunset Arches
    430: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Telephone Reliquary
    431: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' }, // Ring with Inner Desert
    432: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Ceiling of Falling Ember Dust
    433: { endpoint: 'fal-ai/nano-banana', name: 'nano-banana' }, // Orange-Blossom Workstation
    434: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Bowl of Folded Light
    435: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' }, // Clock of Sunrise Rings
    436: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Helmet in Indoor Dunes
    // 39.1-39.10 (437-446): Orange Peach Surreal
    437: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Mirror Flood
    438: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' }, // Elevator of Dust Rooms
    439: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Lamp Bloom
    440: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Sunset Stones
    441: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' }, // Dress Arch
    442: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Dust Stair
    443: { endpoint: 'fal-ai/nano-banana', name: 'nano-banana' }, // Moon Scale
    444: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Ticket Smoke
    445: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' }, // Sand Faucet
    446: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Cloud Glasses
    // 40.1-40.7 (447-453): Mixed Art pt2
    447: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Dachshund with Coffee
    448: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' }, // Ghost at the Cemetery Gate
    449: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Two on a Cloud
    450: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Painted Column Capital
    451: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' }, // Japanese Temple in Flowers
    452: { endpoint: 'fal-ai/nano-banana', name: 'nano-banana' }, // Scream on Old Poster
    453: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' }, // Rabbits Reading a Book
    454: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' }, // Couple on Cloud from Behind
    455: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' }, // Couple on Cloud GoPro Selfie
    // 41.1-41.12 (456-467): Mixed Art pt3
    456: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' }, // Face with Galaxy
    457: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Distorted Face in Charcoal
    458: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Black Abstract Sculpture
    459: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Graphic Flower in Black Lines
    460: { endpoint: 'fal-ai/nano-banana', name: 'nano-banana' }, // Pink Cup on Pink
    461: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' }, // Old Scholar Writing by Candlelight
    462: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Crowd in Golden Light
    463: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Girl Silhouette Under Tree at Sunset
    464: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' }, // Couple on the Pier
    465: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Mouse in Yellow Raincoat
    466: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Mountain Through Rock Crack
    467: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' }, // Rococo Garden Dance
    // 42.1-42.10 (468-477): New Peach Series
    468: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Peach Atrium Veil
    469: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' }, // Apricot Halo Chair
    470: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Peach Tide Clock
    471: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Powder Room Portal
    472: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' }, // Glass Fruit Orbit
    473: { endpoint: 'fal-ai/nano-banana', name: 'nano-banana' }, // Silk Flame Vessel
    474: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Peach Window Reef
    475: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Sunrise Ledger
    476: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' }, // Apricot Bell Tower
    477: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Porcelain Drift Table
    478: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' }, // Miniature Peach House
    // 43.1-43.18 (479-496): Mixed Art pt4
    479: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' }, // City Against Snowy Mountains
    480: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Manga Girl with Gun
    481: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Girl in Hat from Behind
    482: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' }, // Girl and Wolf
    483: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Supercar in Motion
    484: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Pike Leaping from Water
    485: { endpoint: 'fal-ai/nano-banana', name: 'nano-banana' }, // Architectural Building Sketch
    486: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' }, // White Kitten at Window
    487: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Cartoon Dog on Yellow
    488: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Crystal Butterfly on Flower
    489: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' }, // Crystal Music Box with Diamond
    490: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Toy Poodle Puppy
    491: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Luxury Watch Close Up
    492: { endpoint: 'fal-ai/nano-banana', name: 'nano-banana' }, // Samurai in Snowy Night
    493: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' }, // Autumn Suburb from Above
    494: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Bunny from Colorful Egg
    495: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Golden Unicorn Medieval Style
    496: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' }, // City in Bokeh
    // 44.1-44.20 (497-516): Pink-Led Series
    497: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Mirror Check-In
    498: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' }, // Pink Delay Board
    499: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Soft Stone Arcade
    500: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Solar Fossil Window
    501: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' }, // Silent Lipstick Collapse
    502: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Data Orchid Terminal
    503: { endpoint: 'fal-ai/nano-banana', name: 'nano-banana' }, // Pink Time Vestibule
    504: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Relic of Voicemail
    505: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' }, // Apartment of Tender Static
    506: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Archive of Soft Alarms
    507: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Blush Escalator Well
    508: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' }, // Rosewater Operating Theater
    509: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Pink Rotunda Dust
    510: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Scale Error Plaza
    511: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' }, // Ink of the Metro
    512: { endpoint: 'fal-ai/nano-banana', name: 'nano-banana' }, // Powder Rain Runway
    513: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Hopper Morning Shift
    514: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' }, // Magritte Security Check
    515: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // de Lempicka Charging Port
    516: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' }, // Compact Planetarium
    517: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' }, // Pink Storm Over Flower Meadow
    // 45.1-45.10 (518-527): Pink Hero Series
    518: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Selfie Chapel
    519: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' }, // Velvet Fountain
    520: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Pearl Observatory
    521: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Hibiscus Door
    522: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' }, // Rose Onyx Stair
    523: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Runway Reliquary
    524: { endpoint: 'fal-ai/nano-banana', name: 'nano-banana' }, // Mirror Pool Lounge
    525: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Petal Metro Arch
    526: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' }, // Rose Halo Salon
    527: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },       // Moon Balcony
};

function getModelForIndex(index: number): ModelConfig {
    if (MODEL_OVERRIDES[index]) return MODEL_OVERRIDES[index];
    // 0-34 -> flux-dev (35 items = 70%)
    // 35-41 -> flux-pro (7 items ~15%)
    // 42-49 -> flux/schnell (8 items ~15%)
    if (index < 35) return MODELS[0].config;
    if (index < 42) return MODELS[1].config;
    return MODELS[2].config;
}

// Varied sizes: cycle through sizes
const SIZE_OVERRIDES: Record<number, string> = {
    183: 'landscape_16_9',  // 15.5 Traffic Light River — wide cinematic
};

function getSizeForIndex(index: number): string {
    if (SIZE_OVERRIDES[index]) return SIZE_OVERRIDES[index];
    return IMAGE_SIZES[index % IMAGE_SIZES.length];
}

// --- HSL-based color family mapping ---
function hexToFamily(hex: string): string {
    const m = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
    if (!m) return 'black';
    let r = parseInt(m[1], 16) / 255, g = parseInt(m[2], 16) / 255, b = parseInt(m[3], 16) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const l = (max + min) / 2 * 100;
    let s = 0, h = 0;
    if (max !== min) {
        const d = max - min;
        s = (l > 50 ? d / (2 - max - min) : d / (max + min)) * 100;
        if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6 * 360;
        else if (max === g) h = ((b - r) / d + 2) / 6 * 360;
        else h = ((r - g) / d + 4) / 6 * 360;
    }
    if (s < 15) { if (l < 15) return 'black'; if (l > 70) return 'white'; return 'brown'; }
    if (s < 30 && l < 40) return l < 15 ? 'black' : 'brown';
    if (l < 8) return 'black';
    if (l > 95) return 'white';
    if (h >= 10 && h < 40 && l < 45 && s < 80) return 'brown';
    if (h < 15) return l > 70 ? 'pink' : 'red';
    if (h < 40) return 'orange';
    if (h < 65) return 'yellow';
    if (h < 160) return 'green';
    if (h < 185) return 'teal';
    if (h < 210) return 'cyan';
    if (h < 260) return 'blue';
    if (h < 290) return 'indigo';
    if (h < 330) return s > 40 && l > 40 ? 'pink' : 'purple';
    return l > 70 || (l > 50 && s < 60) ? 'pink' : 'red';
}

// --- Bucket mapping ---
const BUCKET_BASE_COLORS = [
    { id: "red", r: 255, g: 23, b: 68 },
    { id: "orange", r: 255, g: 109, b: 0 },
    { id: "yellow", r: 255, g: 234, b: 0 },
    { id: "green", r: 0, g: 230, b: 118 },
    { id: "teal", r: 29, g: 233, b: 182 },
    { id: "cyan", r: 0, g: 229, b: 255 },
    { id: "blue", r: 41, g: 121, b: 255 },
    { id: "indigo", r: 101, g: 31, b: 255 },
    { id: "purple", r: 213, g: 0, b: 249 },
    { id: "pink", r: 255, g: 64, b: 129 },
    { id: "brown", r: 141, g: 110, b: 99 },
    { id: "black", r: 18, g: 18, b: 18 },
    { id: "white", r: 250, g: 250, b: 250 },
];

function mapHexToBucket(hex: string): string | null {
    const m = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
    if (!m) return null;
    const r = parseInt(m[1], 16), g = parseInt(m[2], 16), b = parseInt(m[3], 16);
    let bestId: string | null = null;
    let bestDist = Infinity;
    for (const c of BUCKET_BASE_COLORS) {
        const dist = (r - c.r) ** 2 + (g - c.g) ** 2 + (b - c.b) ** 2;
        if (dist < bestDist) { bestDist = dist; bestId = c.id; }
    }
    return bestId;
}

// --- Color extraction ---
type RGB = [number, number, number];

function rgbToHex([r, g, b]: RGB): string {
    const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
    return `#${clamp(r).toString(16).padStart(2, '0')}${clamp(g).toString(16).padStart(2, '0')}${clamp(b).toString(16).padStart(2, '0')}`.toUpperCase();
}

async function extractColors(imageBuffer: Buffer, count: number = 5): Promise<string[]> {
    const quantizeMod = await import('quantize');
    const quantize = (quantizeMod.default || quantizeMod) as any;

    const { data: pixelData, info } = await sharp(imageBuffer)
        .resize(200, 200, { fit: 'inside', withoutEnlargement: true })
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

    const pixels: RGB[] = [];
    const totalPixels = info.width * info.height;
    for (let i = 0; i < totalPixels; i += 3) {
        const idx = i * info.channels;
        pixels.push([pixelData[idx], pixelData[idx + 1], pixelData[idx + 2]]);
    }

    if (pixels.length === 0) return [];
    const result = quantize(pixels, count * 2);
    if (!result) return [];
    const palette = (result.palette() as RGB[]).slice(0, count);
    return palette.map(rgbToHex);
}

// --- Color positions ---
type ColorPosition = { hex: string; x: number; y: number };

function hexToRgbObj(hex: string): { r: number; g: number; b: number } | null {
    const m = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
    if (!m) return null;
    return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
}

async function findColorPositions(buffer: Buffer, colors: string[]): Promise<ColorPosition[]> {
    try {
        const { data, info } = await sharp(buffer)
            .resize(200, 200, { fit: 'inside' })
            .removeAlpha()
            .raw()
            .toBuffer({ resolveWithObject: true });

        const targetRgbs = colors.map(hex => hexToRgbObj(hex));
        const THRESHOLD = 60;
        const GRID = 10;
        const gridW = Math.ceil(info.width / GRID);
        const gridH = Math.ceil(info.height / GRID);

        const grids = targetRgbs.map(() =>
            Array.from({ length: gridH }, () => new Float64Array(gridW))
        );

        for (let y = 0; y < info.height; y++) {
            for (let x = 0; x < info.width; x++) {
                const i = (y * info.width + x) * info.channels;
                const r = data[i], g = data[i + 1], b = data[i + 2];

                let bestIdx = -1;
                let bestDist = Infinity;
                for (let ci = 0; ci < targetRgbs.length; ci++) {
                    const t = targetRgbs[ci];
                    if (!t) continue;
                    const dist = Math.sqrt((r - t.r) ** 2 + (g - t.g) ** 2 + (b - t.b) ** 2);
                    if (dist < bestDist) { bestDist = dist; bestIdx = ci; }
                }
                if (bestIdx >= 0 && bestDist < THRESHOLD) {
                    const gx = Math.min(Math.floor(x / GRID), gridW - 1);
                    const gy = Math.min(Math.floor(y / GRID), gridH - 1);
                    grids[bestIdx][gy][gx] += 1 / (1 + bestDist);
                }
            }
        }

        const positions: ColorPosition[] = [];
        for (let ci = 0; ci < colors.length; ci++) {
            let maxDensity = 0, peakGx = 0, peakGy = 0;
            for (let gy = 0; gy < gridH; gy++) {
                for (let gx = 0; gx < gridW; gx++) {
                    if (grids[ci][gy][gx] > maxDensity) {
                        maxDensity = grids[ci][gy][gx]; peakGx = gx; peakGy = gy;
                    }
                }
            }
            if (maxDensity > 0) {
                positions.push({
                    hex: colors[ci],
                    x: (peakGx + 0.5) * GRID / info.width,
                    y: (peakGy + 0.5) * GRID / info.height,
                });
            } else {
                positions.push({ hex: colors[ci], x: 0.2 + (ci * 0.15), y: 0.3 + (ci * 0.1) });
            }
        }

        // Separate close markers
        const MIN_DIST = 0.08;
        for (let i = 0; i < positions.length; i++) {
            for (let j = i + 1; j < positions.length; j++) {
                const dx = positions[j].x - positions[i].x;
                const dy = positions[j].y - positions[i].y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < MIN_DIST && dist > 0) {
                    const scale = (MIN_DIST - dist) / 2 / dist;
                    positions[i].x = Math.max(0.02, Math.min(0.98, positions[i].x - dx * scale));
                    positions[i].y = Math.max(0.02, Math.min(0.98, positions[i].y - dy * scale));
                    positions[j].x = Math.max(0.02, Math.min(0.98, positions[j].x + dx * scale));
                    positions[j].y = Math.max(0.02, Math.min(0.98, positions[j].y + dy * scale));
                }
            }
        }

        return positions;
    } catch (error) {
        console.error('findColorPositions error:', error);
        return colors.map((hex, i) => ({ hex, x: 0.2 + (i * 0.15), y: 0.3 + (i * 0.1) }));
    }
}

// --- Aspect ratio ---
function getAspectRatioString(w: number, h: number): string {
    const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
    const d = gcd(w, h);
    return `${w / d}:${h / d}`;
}

// --- Generate image via fal.ai ---
async function generateImage(prompt: string, endpoint: string, imageSize: string): Promise<{
    url: string;
    width: number;
    height: number;
    seed: string;
} | null> {
    console.log(`   Calling ${endpoint} with size=${imageSize}...`);

    // nano-banana uses aspect_ratio ("1:1", "4:3") instead of image_size ("square_hd")
    const isNanoBanana = endpoint.includes('nano-banana');
    const sizeToAspect: Record<string, string> = {
        'square_hd': '1:1',
        'landscape_4_3': '4:3',
        'landscape_16_9': '16:9',
        'portrait_4_3': '3:4',
        'portrait_16_9': '9:16',
    };

    const body: any = {
        prompt,
        num_images: 1,
    };
    if (isNanoBanana) {
        body.aspect_ratio = sizeToAspect[imageSize] ?? '1:1';
    } else {
        body.image_size = imageSize;
        body.enable_safety_checker = false;
    }

    const res = await fetch(`https://queue.fal.run/${endpoint}`, {
        method: 'POST',
        headers: {
            'Authorization': `Key ${FAL_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        console.error(`   fal.ai error ${res.status}:`, await res.text().catch(() => ''));
        return null;
    }

    const data = await res.json();

    // Handle queue response — use URLs from fal.ai response directly
    if (data.request_id && !data.images) {
        return await pollForResult(data.status_url, data.response_url);
    }

    const img = data.images?.[0];
    if (!img?.url) {
        console.error('   No image in response');
        return null;
    }

    return {
        url: img.url,
        width: img.width,
        height: img.height,
        seed: data.seed?.toString() ?? null,
    };
}

async function pollForResult(statusUrl: string, responseUrl: string): Promise<{
    url: string;
    width: number;
    height: number;
    seed: string;
} | null> {
    console.log(`   Queued, polling...`);
    const maxAttempts = 60; // 5 minutes max

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        await new Promise(r => setTimeout(r, 5000));

        const statusRes = await fetch(statusUrl, {
            headers: { 'Authorization': `Key ${FAL_KEY}` },
        });
        const statusText = await statusRes.text();
        let status: any;
        try { status = JSON.parse(statusText); } catch {
            console.error(`   Bad status response: ${statusText.substring(0, 100)}`);
            continue;
        }

        if (status.status === 'COMPLETED') {
            const resultRes = await fetch(responseUrl, {
                headers: { 'Authorization': `Key ${FAL_KEY}` },
            });
            const data = await resultRes.json();
            const img = data.images?.[0];
            if (!img?.url) return null;
            return {
                url: img.url,
                width: img.width,
                height: img.height,
                seed: data.seed?.toString() ?? null,
            };
        }

        if (status.status === 'FAILED') {
            console.error(`   Generation failed: ${status.error}`);
            return null;
        }

        process.stdout.write('.');
    }

    console.error('   Timeout waiting for generation');
    return null;
}

// --- Auto-tags: extract keywords from prompt ---
const STOP_WORDS = new Set([
    // Articles, prepositions, conjunctions
    'a', 'an', 'the', 'in', 'on', 'at', 'of', 'to', 'for', 'by', 'with', 'from',
    'and', 'or', 'but', 'nor', 'as', 'if', 'than', 'that', 'this', 'its', 'it',
    'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
    'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might',
    'not', 'no', 'into', 'through', 'between', 'under', 'over', 'above', 'below',
    'near', 'across', 'along', 'around', 'behind', 'beside', 'during', 'after',
    'before', 'about', 'against', 'among', 'within', 'without',
    // Prompt filler words (style/quality descriptors that aren't useful as tags)
    'highly', 'very', 'ultra', 'extremely', 'incredibly', 'strongly',
    'detailed', 'sharp', 'focus', 'high', 'resolution', 'quality', 'hd', '4k', '8k',
    'entire', 'whole', 'full', 'broad', 'wide', 'large', 'small', 'tiny', 'huge',
    'almost', 'nearly', 'completely', 'slightly', 'barely', 'mostly',
    'each', 'every', 'all', 'both', 'many', 'several', 'few', 'some',
    'style', 'look', 'feeling', 'tone', 'tones', 'cast', 'effect',
    'image', 'photo', 'photograph', 'photography', 'picture', 'scene',
    'rendering', 'render', 'generated', 'creating', 'created',
    'filling', 'dominating', 'covering', 'stretching', 'drifting',
    'overflowing', 'flowing', 'suspended', 'lined', 'shaped',
    'immersive', 'environment', 'composition', 'perspective', 'depth',
    'textures', 'texture', 'textured', 'richly', 'surfaces', 'surface',
    'clean', 'fine', 'crisp', 'elegant', 'beautiful', 'stunning', 'vivid',
    'natural', 'neutral', 'bright', 'dark', 'dim', 'warm', 'cool', 'soft', 'pale',
    'deep', 'faint', 'layered', 'minimal', 'dense',
    // Adjectives that aren't useful as tags
    'endless', 'spacious', 'narrow', 'enormous', 'lush', 'old', 'new', 'ancient',
    'massive', 'giant', 'thick', 'thin', 'tall', 'short', 'long', 'heavy', 'light',
    'wet', 'dry', 'hot', 'cold', 'raw', 'pure', 'real', 'surreal', 'dramatic',
    'strong', 'weak', 'open', 'vast', 'rich', 'flat', 'steep', 'rough', 'smooth',
    // More adjectives commonly found in prompts
    'spectacular', 'monumental', 'sculptural', 'translucent', 'magnificent',
    'gigantic', 'miniature', 'gorgeous', 'intricate', 'elaborate', 'ornate',
    'delicate', 'transparent', 'opaque', 'muted', 'vibrant', 'saturated',
    'monochrome', 'polished', 'raw', 'sacred', 'divine', 'celestial',
    'hidden', 'secret', 'mysterious', 'magical', 'enchanted', 'mystic',
    'electric', 'internal', 'external', 'visible', 'invisible',
    'symmetrical', 'asymmetrical', 'geometric', 'organic',
    // Verbs / participles that aren't useful as tags
    'inside', 'split', 'unleashing', 'illuminated',
    'arranged', 'scattered', 'frozen', 'molten', 'liquid',
    'erupting', 'crashing', 'dripping', 'swirling', 'spiraling',
    'cascading', 'spilling', 'pooling', 'curling', 'wrapping',
    'reflecting', 'refracting', 'filtering', 'piercing', 'radiating',
    'dominating', 'surrounding', 'enveloping', 'embracing',
    'streams', 'bolts', 'glows', 'arcs', 'shafts', 'beams', 'rays',
    'splashes', 'droplets', 'particles', 'bits', 'pieces', 'chunks',
    'jewel-like', 'syrup-like', 'dream-like', 'life-like',
    'plant', 'plants', 'mid-air', 'mid-motion',
    // Adverbs / conjunctive words that slip through -ly filter
    'instead', 'where', 'there', 'here', 'when', 'while', 'also', 'just',
    'even', 'still', 'yet', 'once', 'then', 'thus', 'hence', 'ever', 'never',
    'always', 'often', 'already', 'rather', 'quite', 'perhaps', 'maybe',
    'together', 'apart', 'away', 'back', 'down', 'out', 'off',
    // Verbs commonly found in prompts
    'made', 'like', 'set', 'placed', 'sits', 'seen', 'lit', 'held',
    'given', 'taken', 'left', 'turned', 'built', 'grown', 'kept', 'let',
    'put', 'run', 'cut', 'hit', 'got', 'get', 'say', 'use', 'try',
    'make', 'take', 'come', 'give', 'show', 'seem', 'feel', 'know',
    'rising', 'holding', 'standing', 'sitting', 'hanging', 'floating',
    'glowing', 'forming', 'growing', 'moving', 'falling', 'turning',
    'breaking', 'catching', 'reaching', 'splitting', 'pulsing',
    // Prepositions / relative pronouns missed earlier
    'upon', 'beneath', 'onto', 'toward', 'towards', 'which', 'whose',
    'whom', 'what', 'how', 'why', 'whether', 'such', 'other', 'another',
    // Prompt-specific filler
    'frame', 'contrast', 'dominance', 'realism', 'realistic', 'cinematic',
    'overhead', 'background', 'foreground', 'midground', 'silhouette',
    'daylight', 'moonlight', 'sunlight', 'candlelight', 'backlight',
    'shadows', 'reflections', 'highlights', 'contour',
    // More style/quality filler
    'premium', 'aesthetic', 'fantasy', 'editorial', 'luxurious', 'luxury',
    'majestic', 'epic', 'mythic', 'baroque', 'impossible', 'refined',
    'dominant', 'palette', 'competing', 'colors', 'colour', 'text',
    'detail', 'scale', 'atmosphere', 'diffusion', 'transformation',
    'worldbuilding', 'interior', 'exterior',
]);

// Color synonyms → normalized color tag
const COLOR_MAP: Record<string, string> = {
    purple: 'purple', violet: 'purple', amethyst: 'purple', plum: 'purple',
    lilac: 'purple', indigo: 'purple', lavender: 'purple',
    yellow: 'yellow', golden: 'yellow', lemon: 'yellow', canary: 'yellow',
    red: 'red', crimson: 'red', scarlet: 'red',
    blue: 'blue', azure: 'blue', cobalt: 'blue', sapphire: 'blue',
    green: 'green', emerald: 'green', jade: 'green',
    pink: 'pink', magenta: 'pink',
    orange: 'orange', amber: 'orange',
    white: 'white', black: 'black',
};

// Compound names that should become a single tag (lowercased)
const COMPOUND_TAGS: [string, string][] = [
    ['van gogh', 'van-gogh'],
    ['claude monet', 'monet'],
    ['pablo picasso', 'picasso'],
    ['salvador dali', 'dali'],
    ['edgar degas', 'degas'],
    ['gustav klimt', 'klimt'],
    ['henri matisse', 'matisse'],
    ['katsushika hokusai', 'hokusai'],
    ['andy warhol', 'warhol'],
    ['frida kahlo', 'frida-kahlo'],
    ['wassily kandinsky', 'kandinsky'],
    ['piet mondrian', 'mondrian'],
    ['rene magritte', 'magritte'],
    ['edward hopper', 'hopper'],
    ['jackson pollock', 'pollock'],
    ['mark rothko', 'rothko'],
    ['alphonse mucha', 'mucha'],
    ['alfons mucha', 'mucha'],
    ['hieronymus bosch', 'bosch'],
    ['jan vermeer', 'vermeer'],
    ['johannes vermeer', 'vermeer'],
    ['el greco', 'el-greco'],
    ['paul cezanne', 'cezanne'],
    ['kazimir malevich', 'malevich'],
    ['marc chagall', 'chagall'],
];

function extractTags(prompt: string): string[] {
    const tags = new Set<string>();

    let lowerPrompt = prompt.toLowerCase();

    // Extract compound tags first and remove them from prompt
    const usedParts = new Set<string>();
    for (const [pattern, tag] of COMPOUND_TAGS) {
        if (lowerPrompt.includes(pattern)) {
            tags.add(tag);
            // Mark individual words so they don't appear as separate tags
            for (const word of pattern.split(' ')) {
                usedParts.add(word);
            }
        }
    }

    const words = lowerPrompt
        .replace(/[^a-z0-9\s-]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 2);

    // Extract meaningful keywords (nouns, key adjectives)
    for (const w of words) {
        if (STOP_WORDS.has(w)) continue;
        if (COLOR_MAP[w]) continue;
        if (usedParts.has(w)) continue; // skip parts of compound tags
        if (w.endsWith('ly') || w.endsWith('ing') || w.endsWith('ed')) continue;
        if (w.length <= 2) continue;
        tags.add(w);
    }

    return [...tags].slice(0, 3);
}

// --- Main ---
async function main() {
    const args = process.argv.slice(2);
    const startIdx = parseInt(args.find((_, i, a) => a[i - 1] === '--start') ?? '0');
    const count = parseInt(args.find((_, i, a) => a[i - 1] === '--count') ?? '50');
    const dryRun = args.includes('--dry-run');

    const slice = prompts.slice(startIdx, startIdx + count);
    console.log(`\n=== Batch Generate: ${slice.length} images ===`);
    console.log(`Start: ${startIdx}, Count: ${count}, Dry run: ${dryRun}\n`);

    let success = 0;
    let failed = 0;

    for (let i = 0; i < slice.length; i++) {
        const globalIdx = startIdx + i;
        const p = slice[i];
        const model = getModelForIndex(globalIdx);
        const imageSize = getSizeForIndex(globalIdx);

        console.log(`\n[${i + 1}/${slice.length}] ${p.id} "${p.title}"`);
        console.log(`   Model: ${model.name}, Size: ${imageSize}`);

        if (dryRun) {
            console.log(`   [DRY RUN] Would generate with private prompt`);
            console.log(`   Public: ${p.public.substring(0, 60)}...`);
            continue;
        }

        try {
            // 1. Generate image via fal.ai using PUBLIC prompt (color names work better)
            // Add per-image environment context for more natural look
            const envContext = (ENVIRONMENT_CONTEXTS as Record<number, string>)[globalIdx] ?? "";
            const fullPrompt = envContext ? p.public + ", " + envContext : p.public;
            const result = await generateImage(fullPrompt, model.endpoint, imageSize);
            if (!result) {
                console.error(`   FAILED to generate`);
                failed++;
                continue;
            }
            console.log(`   Generated: ${result.width}x${result.height}, seed=${result.seed}`);

            // 2. Download image (with retry for DNS flakes)
            let imageBuffer: Buffer | null = null;
            for (let dl = 0; dl < 3; dl++) {
                try {
                    const imgRes = await fetch(result.url);
                    if (!imgRes.ok) {
                        console.error(`   Download attempt ${dl + 1} failed: ${imgRes.status}`);
                        await new Promise(r => setTimeout(r, 2000));
                        continue;
                    }
                    imageBuffer = Buffer.from(await imgRes.arrayBuffer());
                    break;
                } catch (dlErr: any) {
                    console.error(`   Download attempt ${dl + 1} error: ${dlErr.message}`);
                    await new Promise(r => setTimeout(r, 3000));
                }
            }
            if (!imageBuffer) {
                console.error(`   FAILED to download after 3 attempts`);
                failed++;
                continue;
            }
            console.log(`   Downloaded: ${(imageBuffer.length / 1024).toFixed(0)} KB`);

            // 3. Extract colors
            const colors = await extractColors(imageBuffer, 5);
            console.log(`   Colors: ${colors.join(', ')}`);

            // 4. Get NTC names
            let colorNames: string[] = [];
            try {
                const namer = (await import('color-namer')).default;
                colorNames = colors.map((hex) => {
                    try { return namer(hex).ntc[0]?.name ?? ''; } catch { return ''; }
                }).filter(Boolean);
            } catch { }

            // 5. Get families
            const colorFamilies = colors.map(hexToFamily);

            // 6. Find color positions
            const colorPositions = await findColorPositions(imageBuffer, colors);

            // 7. Upload to Supabase Storage
            const safeTitle = p.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-');
            const fileName = `purple_${safeTitle}_${Date.now()}.jpg`;
            const storagePath = `uploads/${fileName}`;

            const { error: uploadError } = await supabase
                .storage
                .from('images')
                .upload(storagePath, imageBuffer, {
                    contentType: 'image/jpeg',
                    upsert: false,
                });

            if (uploadError) {
                console.error(`   Upload error:`, uploadError.message);
                failed++;
                continue;
            }

            // 8. Calculate aspect ratio (fallback to sharp metadata if API returns null)
            let imgWidth = result.width;
            let imgHeight = result.height;
            if (!imgWidth || !imgHeight) {
                const meta = await sharp(imageBuffer).metadata();
                imgWidth = meta.width ?? 0;
                imgHeight = meta.height ?? 0;
            }
            const aspectRatio = imgWidth && imgHeight
                ? getAspectRatioString(imgWidth, imgHeight)
                : null;

            // 9. Build tags
            const tags = extractTags(fullPrompt);

            // 10. Insert into images_meta with BOTH prompts
            const row = {
                user_id: IMPORT_USER_ID,
                path: storagePath,
                title: p.title,
                description: null,
                prompt: fullPrompt,
                private_prompt: p.private,
                colors: colors.length ? colors.map(c => c.toLowerCase()) : null,
                color_weights: null,
                color_names: colorNames.length ? colorNames : null,
                color_families: colorFamilies.length ? colorFamilies : null,
                accent_colors: null,
                color_positions: colorPositions.length ? colorPositions : null,
                dominant_color: mapHexToBucket(colors[0]) ?? null,
                secondary_color: mapHexToBucket(colors[1]) ?? null,
                third_color: mapHexToBucket(colors[2]) ?? null,
                fourth_color: mapHexToBucket(colors[3]) ?? null,
                fifth_color: mapHexToBucket(colors[4]) ?? null,
                aspect_ratio: aspectRatio,
                model: model.name,
                seed: result.seed,
                source: null,
                source_author: null,
                source_url: result.url,
                tags,
            };

            const { data, error: insertError } = await supabase
                .from('images_meta')
                .insert(row)
                .select('id');

            if (insertError) {
                console.error(`   DB insert error:`, insertError.message);
                failed++;
                continue;
            }

            console.log(`   OK! ID: ${data?.[0]?.id} | ${storagePath}`);
            success++;

        } catch (err: any) {
            console.error(`   ERROR: ${err.message}`);
            failed++;
        }
    }

    console.log(`\n=== Done! Success: ${success}, Failed: ${failed} ===\n`);
}

main().catch(console.error);
