const DECORATION_KEYWORDS = [
  "official",
  "video",
  "audio",
  "lyric",
  "lyrics",
  "visualizer",
  "visualiser",
  "music video",
  "official video",
  "official audio",
  "lyric video",
  "remaster",
  "remastered",
  "hd",
  "hq",
  "4k"
];

function stripDecoratedBrackets(value: string): string {
  return value.replace(/[([{][^)\]}]*[)\]}]/g, (match) => {
    const inner = match.slice(1, -1).toLowerCase();
    return DECORATION_KEYWORDS.some((keyword) => inner.includes(keyword)) ? " " : match;
  });
}

function stripFeatured(value: string): string {
  return value.replace(/\b(feat|ft|featuring)\b\.?.*$/i, " ");
}

function stripSuffix(value: string): string {
  return value.replace(/\s*-\s*topic\s*$/i, " ").replace(/vevo\s*$/i, " ");
}

function collapse(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalize(raw: string): string {
  if (!raw) return "";
  let value = stripDecoratedBrackets(raw);
  value = stripSuffix(value);
  value = stripFeatured(value);
  return collapse(value);
}

export function looksLikeMatch(a: string, b: string): boolean {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return false;
  return na.includes(nb) || nb.includes(na);
}
