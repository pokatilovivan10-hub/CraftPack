/** Форматирование цены: "54.60" → "54,60 ₽", "54.00" → "54 ₽". */
export function formatPrice(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "Цена по запросу";
  const s = String(value).trim();
  if (!/^-?\d+(\.\d+)?$/.test(s)) return "Цена по запросу";
  const [i, f = ""] = s.split(".");
  const grouped = i.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const frac = (f + "00").slice(0, 2);
  return frac === "00" ? `${grouped} ₽` : `${grouped},${frac} ₽`;
}

/** Склонение: 1 товар, 2 товара, 5 товаров. */
export function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}

export function productsCount(n: number): string {
  return `${n} ${plural(n, "товар", "товара", "товаров")}`;
}

/** Склонение: 1 позиция, 2 позиции, 5 позиций. */
export function positionsCount(n: number): string {
  return `${n} ${plural(n, "позиция", "позиции", "позиций")}`;
}

export function formatDateRu(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function imageUrl(storageKey: string | null | undefined): string | null {
  if (!storageKey) return null;
  const key = storageKey.replace(/^\//, "");
  // Фото товаров отдаём через /api/uploads/*: этот путь всегда доходит до
  // сервера, тогда как /uploads/* может перехватываться статическим слоем
  // платформы, где файлов загрузок нет.
  if (key.startsWith("uploads/")) return "/api/" + key;
  return "/" + key;
}

/** srcset для изображения с дополнительными размерами (variants: {"480": "uploads/..."}). */
export function imageSrcSet(img: {
  storageKey: string;
  width?: number | null;
  variants?: unknown;
}): string | undefined {
  const orig = imageUrl(img.storageKey);
  if (!orig) return undefined;
  const v = (img.variants ?? null) as Record<string, string> | null;
  const parts: string[] = [];
  if (v?.["480"]) parts.push(`${imageUrl(v["480"])} 480w`);
  if (img.width && img.width > 0) parts.push(`${orig} ${img.width}w`);
  return parts.length > 1 ? parts.join(", ") : undefined;
}
