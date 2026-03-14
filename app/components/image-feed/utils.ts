/** Красивые подписи для моделей */
const MODEL_LABELS: Record<string, string> = {
  sora: "Sora",
  veo: "Veo",
  "veo-2": "Veo 2",
  "veo-3": "Veo 3",
  "veo-3.1": "Veo 3.1",
  midjourney: "MidJourney",
  "stable diffusion xl": "Stable Diffusion XL",
  "stable-diffusion-xl": "Stable Diffusion XL",
  "stable diffusion 3": "Stable Diffusion 3",
  "stable-diffusion-3": "Stable Diffusion 3",
  sdxl: "SDXL",
  pika: "Pika",
  runway: "Runway",
  flux: "Flux",
  dalle: "DALL\u00B7E",
  "dalle 3": "DALL\u00B7E 3",
  "dalle-3": "DALL\u00B7E 3",
  "dall-e": "DALL\u00B7E",
  "dall-e 3": "DALL\u00B7E 3",
  "dall-e-3": "DALL\u00B7E 3",
  kandinsky: "Kandinsky",
  leonardo: "Leonardo",
  ideogram: "Ideogram",
  playground: "Playground",
  krea: "KREA",
};

export function formatModelName(raw?: string | null): string {
  if (!raw) return "\u043D\u0435 \u0443\u043A\u0430\u0437\u0430\u043D\u0430";
  const key = raw.toLowerCase();
  return MODEL_LABELS[key] ?? raw;
}

/** Форматирует дату в формате "DEC 25" (месяц + год) */
export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const month = date.toLocaleDateString("en-US", { month: "short" }).toUpperCase();
  const year = date.getFullYear().toString().slice(-2);
  return `${month} ${year}`;
}
