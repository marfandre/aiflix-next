const MODEL_LABELS: Record<string, string> = {
  sora: "Sora",
  pika: "Pika",
  runway: "Runway",
  kling: "Kling",
  "gen-3": "Gen-3",
  midjourney: "Midjourney",
  sdxl: "SDXL",
  dalle: "DALL\u00B7E",
  "dall-e": "DALL\u00B7E",
  flux: "Flux",
  krea: "KREA",
  veo: "Veo",
  "veo-2": "Veo 2",
  "veo-3": "Veo 3",
  "veo-3.1": "Veo 3.1",
};

export function formatModelName(raw?: string | null): string {
  if (!raw) return "\u043D\u0435 \u0443\u043A\u0430\u0437\u0430\u043D\u0430";
  const key = raw.toLowerCase();
  return MODEL_LABELS[key] ?? raw;
}

export function muxPoster(playback_id: string | null) {
  return playback_id
    ? `https://image.mux.com/${playback_id}/thumbnail.jpg?time=1`
    : "/placeholder.png";
}
