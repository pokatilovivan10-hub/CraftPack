const RU_MAP: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z",
  и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
  с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "c", ч: "ch", ш: "sh",
  щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

export function transliterate(input: string): string {
  return input
    .toLowerCase()
    .split("")
    .map((ch) => RU_MAP[ch] ?? ch)
    .join("");
}

/** Человекочитаемый slug из русского названия. */
export function slugify(input: string): string {
  return transliterate(input)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 180);
}

/** Slug артикула для уникализации URL товара (дефисы и нули сохраняются). */
export function skuToSlug(sku: string): string {
  return sku
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Slug товара: база из названия + артикул для гарантированной уникальности. */
export function productSlug(title: string, sku: string): string {
  const base = slugify(title).slice(0, 120).replace(/-+$/g, "");
  const suffix = skuToSlug(sku);
  return base ? `${base}-${suffix}` : suffix;
}

/** Нормализация строки для поиска: lowercase, ё→е, сжатие пробелов. */
export function normalizeSearch(input: string): string {
  return input
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/\s+/g, " ")
    .trim();
}
