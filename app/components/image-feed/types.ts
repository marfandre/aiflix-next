export type ColorPosition = {
  hex: string;
  x: number;
  y: number;
};

export type ImageRow = {
  id: string;
  user_id: string | null;
  path: string;
  title: string | null;
  description?: string | null;
  prompt?: string | null;
  created_at: string | null;
  colors: string[] | null;
  accent_colors?: string[] | null;
  color_positions?: ColorPosition[] | null;
  model?: string | null;
  aspect_ratio?: string | null;
  tags?: string[] | null;
  images_count?: number | null;
  profiles:
  | { username: string | null; avatar_url: string | null }[]
  | { username: string | null; avatar_url: string | null }
  | null;
};

export type ImageVariant = {
  path: string;
  colors: string[] | null;
  order_index: number | null;
};

export type SearchParams = {
  colors?: string;
  models?: string;
  moods?: string;
  imageTypes?: string;
};
