/**
 * Осторожный разбор денежных значений из прайс-листов.
 * Понимает точку/запятую, пробелы-разделители, не использует float для хранения.
 * Возвращает нормализованную строку с двумя знаками ("54.60") или null.
 */
export function parseDecimal(input: unknown): string | null {
  if (input === null || input === undefined) return null;
  if (typeof input === "number") {
    if (!Number.isFinite(input)) return null;
    // Числа из XLSX — float; приводим через строку с округлением до копеек
    return normalizeDecimalString(input.toFixed(4));
  }
  if (typeof input !== "string") return null;
  let s = input.trim();
  if (!s) return null;
  // Убираем пробелы-разделители тысяч (в т.ч. неразрывные) и валютные символы
  s = s.replace(/[\u00A0\u2009\u202F\s]/g, "").replace(/[₽рRUB]/gi, "");
  s = s.replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  return normalizeDecimalString(s);
}

function normalizeDecimalString(s: string): string | null {
  const neg = s.startsWith("-");
  const raw = neg ? s.slice(1) : s;
  const [intPart, fracPart = ""] = raw.split(".");
  if (!/^\d+$/.test(intPart) || (fracPart && !/^\d+$/.test(fracPart))) return null;
  // Округление до 2 знаков «от нуля» по третьему знаку
  let cents = BigInt(intPart) * 100n + BigInt((fracPart + "00").slice(0, 2));
  const third = fracPart.length > 2 ? Number(fracPart[2]) : 0;
  if (third >= 5) cents += 1n;
  const whole = cents / 100n;
  const frac = (cents % 100n).toString().padStart(2, "0");
  return `${neg ? "-" : ""}${whole.toString()}.${frac}`;
}

/** Сложение/умножение денег в целых копейках, без float. */
export function moneyAdd(a: string, b: string): string {
  return fromCents(toCents(a) + toCents(b));
}
export function moneyMul(a: string, qty: number): string {
  return fromCents(toCents(a) * BigInt(qty));
}
export function toCents(a: string): bigint {
  const neg = a.startsWith("-");
  const raw = neg ? a.slice(1) : a;
  const [i, f = ""] = raw.split(".");
  const cents = BigInt(i) * 100n + BigInt((f + "00").slice(0, 2));
  return neg ? -cents : cents;
}
export function fromCents(c: bigint): string {
  const neg = c < 0n;
  const abs = neg ? -c : c;
  return `${neg ? "-" : ""}${(abs / 100n).toString()}.${(abs % 100n).toString().padStart(2, "0")}`;
}

/** Форматирование цены для интерфейса: "54.60" → "54,60 ₽", "54.00" → "54 ₽". */
export function formatPrice(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "Цена по запросу";
  const norm = parseDecimal(String(value));
  if (norm === null) return "Цена по запросу";
  const [i, f] = norm.split(".");
  const grouped = i.replace(/\B(?=(\d{3})+(?!\d))/g, "\u00A0");
  return f === "00" ? `${grouped} ₽` : `${grouped},${f} ₽`;
}
