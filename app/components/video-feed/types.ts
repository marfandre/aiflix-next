export type VideoRow = {
  id: string;
  author_id: string | null;
  title: string | null;
  description?: string | null;
  prompt?: string | null;
  playback_id: string | null;
  created_at: string | null;
  model?: string | null;
  genres?: string[] | null;
  mood?: string | null;
  colors?: string[] | null;
  colors_preview?: string[] | null;
  colors_full?: string[] | null;
  colors_full_interval?: number | null;
  color_mode?: string | null;
  status?: string | null;
  aspect_ratio?: string | null;
  profiles:
    | { username: string | null; avatar_url: string | null }[]
    | { username: string | null; avatar_url: string | null }
    | null;
};
