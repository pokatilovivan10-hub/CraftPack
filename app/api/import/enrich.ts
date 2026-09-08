/**
 * Осторожный парсер характеристик из названия товара.
 * Всегда сохраняем исходное название отдельно; извлечённые значения — inferred
 * с уровнем уверенности. Сомнительные значения не угадываем.
 */

export interface InferredAttribute {
  key: string;
  value: string;
  normalizedValue?: string;
  unit?: string;
  confidence: number; // 0..100
}

const COLOR_WORDS = [
  "белый", "чёрный", "черный", "красный", "розовый", "голубой", "бледно-голубой",
  "бледно-зелёный", "бледно-зеленый", "зелёный", "зеленый", "синий", "жёлтый", "желтый",
  "оранжевый", "фиолетовый", "сиреневый", "персиковый", "бежевый", "коричневый",
  "серый", "серебряный", "золотой", "золото", "серебро", "тиффани", "мятный",
  "пудровый", "бордовый", "крафт", "крафтовый", "прозрачный", "черно-золотой",
];

const SHAPE_WORDS: Record<string, string> = {
  квадратная: "квадратная",
  квадратный: "квадратная",
  прямоугольная: "прямоугольная",
  прямоугольный: "прямоугольная",
  круглая: "круглая",
  круглый: "круглая",
  шестигранная: "шестигранная",
  сердце: "сердце",
  ваза: "ваза",
  тубус: "тубус",
};

/**
 * Размеры вида «10,6*10,7*7,2» или «10*10*5» (см) — нормализуем в мм
 * только при однозначном распознавании (2–3 компонента, значения < 200 см).
 */
function parseDimensions(title: string): InferredAttribute | null {
  const m = title.match(/(\d+(?:[,.]\d+)?)\s*[*×xх]\s*(\d+(?:[,.]\d+)?)\s*(?:[*×xх]\s*(\d+(?:[,.]\d+)?))?/);
  if (!m) return null;
  // Единицы не в сантиметрах — не угадываем: «0,57*10м» (метры), «2,5см*25ярд» (ярды)
  const after = title.slice((m.index ?? 0) + m[0].length);
  if (/^\s*(м|ярд)/i.test(after) || /(см|м)\s*[*×xх]\s*\d+(?:[,.]\d+)?\s*ярд/i.test(title)) return null;
  const parts = [m[1], m[2], m[3]].filter(Boolean).map((s) => parseFloat(s!.replace(",", ".")));
  if (parts.some((v) => !Number.isFinite(v) || v <= 0 || v >= 200)) return null;
  const mm = parts.map((v) => Math.round(v * 10));
  return {
    key: "dimensions",
    value: parts.map((v) => String(v).replace(".", ",")).join("×") + " см",
    normalizedValue: mm.join("x"),
    unit: "mm",
    confidence: 85,
  };
}

/** Упаковочная кратность вида «1/10 1/120» — справочная информация. */
function parsePacking(title: string): InferredAttribute | null {
  const m = title.match(/(\d+\/\d+(?:\s+\d+\/\d+)+)/);
  if (!m) return null;
  return {
    key: "packing",
    value: m[1],
    normalizedValue: m[1].replace(/\s+/g, " "),
    confidence: 95,
  };
}

function parseColor(title: string): InferredAttribute | null {
  // Отрезаем хвосты «упаковка» и «Арт: …», цвет ищем как последнее слово остатка
  const core = title
    .toLowerCase()
    .replace(/арт:\s*\S+\s*$/i, "")
    .replace(/(\d+\/\d+[\s\d/]*)+$/, "")
    .replace(/[\s,.;\-()"]+$/, "");
  const lastWord = core.split(/\s+/).pop() ?? "";
  // Сортируем по длине, чтобы «бледно-голубой» проверялся раньше «голубой»
  const sorted = [...COLOR_WORDS].sort((a, b) => b.length - a.length);
  for (const color of sorted) {
    if (lastWord === color || core.endsWith(" " + color)) {
      const canonical = color
        .replace("черный", "чёрный")
        .replace("зеленый", "зелёный")
        .replace("желтый", "жёлтый");
      return { key: "color", value: canonical, normalizedValue: canonical, confidence: 70 };
    }
  }
  return null;
}

function parseShape(title: string): InferredAttribute | null {
  const lower = title.toLowerCase();
  for (const [word, canonical] of Object.entries(SHAPE_WORDS)) {
    if (new RegExp(`\\b${word}\\b`, "i").test(lower)) {
      return { key: "shape", value: canonical, normalizedValue: canonical, confidence: 65 };
    }
  }
  return null;
}

function parseSetCount(title: string): InferredAttribute | null {
  const m = title.toLowerCase().match(/набор\s*(?:из)?\s*(\d+)\s*(?:шт|предм)/);
  if (!m) return null;
  return { key: "set_count", value: m[1], normalizedValue: m[1], unit: "шт", confidence: 80 };
}

function parseFinish(title: string): InferredAttribute | null {
  const lower = title.toLowerCase();
  if (/тиснени[емя]/.test(lower)) {
    return { key: "finish", value: "тиснение", normalizedValue: "тиснение", confidence: 75 };
  }
  if (/ламинаци[яи]/.test(lower)) {
    return { key: "finish", value: "ламинация", normalizedValue: "ламинация", confidence: 75 };
  }
  return null;
}

export function inferAttributes(title: string): InferredAttribute[] {
  const attrs: InferredAttribute[] = [];
  for (const fn of [parseDimensions, parsePacking, parseColor, parseShape, parseSetCount, parseFinish]) {
    const attr = fn(title);
    if (attr) attrs.push(attr);
  }
  return attrs;
}
