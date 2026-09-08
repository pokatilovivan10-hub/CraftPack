/**
 * Понятное название для интерфейса: убирает из исходного названия
 * размеры и хвост упаковки, оформляет цвет через запятую.
 * Применяется ТОЛЬКО если удалось уверенно распознать размеры или цвет —
 * нераспознанные товары показывают исходное название без сокращений.
 * Исходное название (sourceTitle) при этом никогда не меняется.
 */

const SIZE_RE = /\d+(?:[,.]\d+)?\s*[*×xх]\s*\d+(?:[,.]\d+)?(?:\s*[*×xх]\s*\d+(?:[,.]\d+)?)?/g;
// Хвост упаковки только в конце строки: "1/20 1/300" или одиночное "1/18"
const PACKING_TAIL_RE = /(\s+\d+\/\d+)+\s*$/;

function sentenceCase(s: string): string {
  const lower = s.toLowerCase();
  // Первая буква строки и первая буква сразу после кавычки/скобки — заглавные
  return lower.replace(/(^|["«(])([а-яёa-z])/gi, (_, p1: string, p2: string) => p1 + p2.toUpperCase());
}

/**
 * Согласование цвета-прилагательного с родом/числом ведущего существительного:
 * «Коробка …, белая», «Коробки …, белые», «Набор …, белый».
 * Неизменяемые слова (крафт, тиффани) возвращаются как есть.
 */
const COLOR_FORMS: Record<string, { f: string; pl: string }> = {
  "белый": { f: "белая", pl: "белые" },
  "чёрный": { f: "чёрная", pl: "чёрные" },
  "черный": { f: "черная", pl: "черные" },
  "красный": { f: "красная", pl: "красные" },
  "розовый": { f: "розовая", pl: "розовые" },
  "голубой": { f: "голубая", pl: "голубые" },
  "бледно-голубой": { f: "бледно-голубая", pl: "бледно-голубые" },
  "синий": { f: "синяя", pl: "синие" },
  "жёлтый": { f: "жёлтая", pl: "жёлтые" },
  "желтый": { f: "желтая", pl: "желтые" },
  "зелёный": { f: "зелёная", pl: "зелёные" },
  "зеленый": { f: "зеленая", pl: "зеленые" },
  "бледно-зелёный": { f: "бледно-зелёная", pl: "бледно-зелёные" },
  "бледно-зеленый": { f: "бледно-зеленая", pl: "бледно-зеленые" },
  "оранжевый": { f: "оранжевая", pl: "оранжевые" },
  "фиолетовый": { f: "фиолетовая", pl: "фиолетовые" },
  "сиреневый": { f: "сиреневая", pl: "сиреневые" },
  "персиковый": { f: "персиковая", pl: "персиковые" },
  "бежевый": { f: "бежевая", pl: "бежевые" },
  "коричневый": { f: "коричневая", pl: "коричневые" },
  "серый": { f: "серая", pl: "серые" },
  "серебряный": { f: "серебряная", pl: "серебряные" },
  "золотой": { f: "золотая", pl: "золотые" },
  "мятный": { f: "мятная", pl: "мятные" },
  "пудровый": { f: "пудровая", pl: "пудровые" },
  "бордовый": { f: "бордовая", pl: "бордовые" },
  "прозрачный": { f: "прозрачная", pl: "прозрачные" },
  "черно-золотой": { f: "черно-золотая", pl: "черно-золотые" },
};

function agreeColor(color: string, headNoun: string): string {
  const forms = COLOR_FORMS[color.toLowerCase()];
  if (!forms) return color; // неизменяемое или неизвестное — как есть
  const noun = headNoun.toLowerCase();
  // В JS \b не работает с кириллицей (не \w) — используем lookahead по кириллическому диапазону
  if (/^(коробки|вазы|коробочки)(?![а-яё])/.test(noun)) return forms.pl;
  if (/^(коробка|ваза|коробочка|шкатулка|банка)(?![а-яё])/.test(noun)) return forms.f;
  return color; // м.р. (набор, тубус) — исходная форма
}

export interface DisplayTitleInput {
  title: string;
  color?: string | null; // normalizedValue цвета, если распознан
  hasDimensions?: boolean;
}

export function displayTitle({ title, color, hasDimensions }: DisplayTitleInput): {
  display: string;
  shortened: boolean;
} {
  if (!color && !hasDimensions) return { display: title, shortened: false };

  let t = title.replace(PACKING_TAIL_RE, "");
  t = t.replace(SIZE_RE, " ");
  t = t.replace(/\s+/g, " ").replace(/\s+([,.;])/g, "$1").trim();
  t = t.replace(/[,\s]+$/, "");
  if (!t || t.length >= title.length) return { display: title, shortened: false };

  // Цвет в конце — отделяем запятой и согласуем с ведущим существительным
  if (color) {
    const tailRe = new RegExp(`\\s+${escapeRe(color)}[а-яё]*$`, "i");
    if (tailRe.test(t)) {
      const agreed = agreeColor(color, t.split(" ")[0] ?? "");
      t = t.replace(tailRe, `, ${agreed}`);
    }
  }

  return { display: sentenceCase(t), shortened: true };
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Ранжирование похожих товаров: форма/назначение → цвет → близость размеров → категория. */
export function relatedScore(
  base: { shape?: string | null; color?: string | null; volume?: number | null; categoryId?: number | null },
  cand: { shape?: string | null; color?: string | null; volume?: number | null; categoryId?: number | null },
): number {
  let score = 0;
  if (base.shape && cand.shape && base.shape === cand.shape) score += 4;
  if (base.color && cand.color && base.color === cand.color) score += 2;
  if (base.volume && cand.volume) {
    const ratio = Math.min(base.volume, cand.volume) / Math.max(base.volume, cand.volume);
    if (ratio >= 0.5) score += 2;
    else if (ratio >= 0.2) score += 1;
  }
  if (base.categoryId && cand.categoryId && base.categoryId === cand.categoryId) score += 1;
  return score;
}

/** Объём из нормализованных размеров "80x80x40" (мм). */
export function dimsVolume(normalized: string | null | undefined): number | null {
  if (!normalized) return null;
  const parts = normalized.split("x").map((x) => Number(x));
  if (parts.some((n) => !Number.isFinite(n) || n <= 0)) return null;
  return parts.reduce((a, b) => a * b, 1);
}
