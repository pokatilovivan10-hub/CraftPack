import { describe, it, expect, beforeAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { parsePriceList } from "../parsePriceList";
import { parseDecimal, formatPrice, moneyMul, moneyAdd } from "../money";
import { stripDuplicateSkuTail } from "../parsePriceList";
import { inferAttributes } from "../enrich";
import { slugify, productSlug, normalizeSearch } from "../slug";
import type { ParseResult } from "../parsePriceList";

const SAMPLE = path.resolve(__dirname, "../../../samples/коробки подарочные.xlsx");

let parsed: ParseResult;

beforeAll(async () => {
  const buf = fs.readFileSync(SAMPLE);
  parsed = await parsePriceList(buf);
}, 60000);

describe("Импорт sample-файла «коробки подарочные.xlsx»", () => {
  it("распознаёт ровно 1 015 товаров", () => {
    expect(parsed.products).toHaveLength(1015);
  });

  it("1 015 уникальных SKU, дублей 0", () => {
    const skus = new Set(parsed.products.map((p) => p.sku));
    expect(skus.size).toBe(1015);
    expect(parsed.issues.filter((i) => i.message.includes("Дубликат"))).toHaveLength(0);
  });

  it("разделы и количества: 750 / 56 / 107 / 102", () => {
    expect(parsed.sections).toEqual({
      "Коробки": 750,
      "Коробки наборы": 56,
      "Коробки одиночные": 107,
      "Коробки ювелирные": 102,
    });
  });

  it("артикул 0007547 не превращён в число", () => {
    const p = parsed.products.find((x) => x.sku === "0007547");
    expect(p).toBeDefined();
    expect(p!.sku).toBe("0007547");
  });

  it("артикул 720111/2 сохранён без изменений", () => {
    expect(parsed.products.some((x) => x.sku === "720111/2")).toBe(true);
  });

  it("к 1 015 товарам сопоставлено 1 015 изображений", () => {
    const withImage = parsed.products.filter((p) => p.image !== null);
    expect(withImage).toHaveLength(1015);
  });

  it("пустое значение ячейки B не мешает найти embedded image", () => {
    const first = parsed.products.find((p) => p.sku === "720111/2");
    expect(first!.image).not.toBeNull();
    expect(first!.image!.bytes.length).toBeGreaterThan(100);
  });

  it("1 006 уникальных изображений (переиспользование допустимо)", () => {
    const hashes = new Set(parsed.products.map((p) => p.image!.hash));
    expect(hashes.size).toBe(1006);
  });

  it("«много» и числовой остаток обрабатываются по-разному", () => {
    const many = parsed.products.filter((p) => p.availabilityRaw.trim() === "много");
    const numeric = parsed.products.filter((p) => /^\d+$/.test(p.availabilityRaw.trim()));
    expect(many).toHaveLength(1006);
    expect(numeric).toHaveLength(9);
    for (const p of many) {
      expect(p.stockStatus).toBe("in_stock");
      expect(p.stockQuantity).toBeNull();
    }
    for (const p of numeric) {
      expect(p.stockStatus).toBe("in_stock");
      expect(p.stockQuantity).toBe(parseInt(p.availabilityRaw.trim(), 10));
    }
  });

  it("цены есть у всех 1 015 товаров, минимум 7,15 ₽, максимум 6 890 ₽", () => {
    const prices = parsed.products.map((p) => p.price);
    expect(prices.every((x) => x !== null)).toBe(true);
    const nums = prices.map((x) => parseFloat(x!));
    expect(Math.min(...nums)).toBeCloseTo(7.15, 2);
    expect(Math.max(...nums)).toBeCloseTo(6890, 2);
  });

  it("метаданные прайса распознаны", () => {
    expect(parsed.priceDate).toBe("2026-09-04 22:22:27");
  });

  it("колонки 3%, 8%, Заказ, Сумма не порождают скидки/цены/остатки", () => {
    // у товаров нет полей скидок; цена берётся только из «Цена (руб.)»
    const p = parsed.products.find((x) => x.sku === "720111/2")!;
    expect(p.price).toBe("54.60");
    expect(Object.keys(p)).not.toContain("discount3");
  });

  it("dry-run фиксируется как режим парсинга без побочек (нет мутаций в parse)", () => {
    expect(typeof parsed.fileChecksum).toBe("string");
    expect(parsed.fileChecksum).toHaveLength(64);
  });
});

describe("Деньги", () => {
  it("54.6 → 54,60 ₽, а не 546 ₽", () => {
    expect(parseDecimal("54.6")).toBe("54.60");
    expect(formatPrice("54.6")).toBe("54,60 ₽");
  });
  it("пробелы и запятые: «1 234,5» → 1 234,50 ₽", () => {
    expect(formatPrice("1 234,5")).toBe("1\u00A0234,50 ₽");
  });
  it("целые без лишних нулей: 6890 → 6 890 ₽", () => {
    expect(formatPrice("6890.00")).toBe("6\u00A0890 ₽");
  });
  it("отсутствующая цена → «Цена по запросу», не 0 ₽", () => {
    expect(formatPrice(null)).toBe("Цена по запросу");
    expect(formatPrice("")).toBe("Цена по запросу");
  });
  it("арифметика в копейках", () => {
    expect(moneyMul("54.60", 3)).toBe("163.80");
    expect(moneyAdd("0.10", "0.20")).toBe("0.30");
  });
});

describe("Хвост «Арт: <sku>»", () => {
  it("удаляется только точное совпадение", () => {
    expect(stripDuplicateSkuTail('Коробка Х Арт: 720111/2', "720111/2")).toBe("Коробка Х");
    // Опечатка в файле: «Арт788/8» при SKU 720788/8 — НЕ удаляем
    expect(stripDuplicateSkuTail("Коробка Х Арт788/8", "720788/8")).toBe("Коробка Х Арт788/8");
  });
});

describe("Enrichment", () => {
  it("извлекает размеры, цвет и упаковку", () => {
    const attrs = inferAttributes(
      'Коробка "Ваза для цветов" 10,6*10,7*7,2 с тиснением "Мини" Белый 1/10 1/120 Арт: 720111/2',
    );
    const byKey = Object.fromEntries(attrs.map((a) => [a.key, a]));
    expect(byKey.dimensions.normalizedValue).toBe("106x107x72");
    expect(byKey.dimensions.unit).toBe("mm");
    expect(byKey.color.normalizedValue).toBe("белый");
    expect(byKey.packing.value).toBe("1/10 1/120");
    expect(byKey.finish.value).toBe("тиснение");
  });
});

describe("Slug и поиск", () => {
  it("транслитерация кириллицы", () => {
    expect(slugify("Коробки подарочные")).toBe("korobki-podarochnye");
  });
  it("slug товара уникален за счёт артикула, нули сохраняются", () => {
    expect(productSlug("Коробка Квадратная 10*10*5 Белый", "0007547")).toContain("0007547");
  });
  it("нормализация ё/е", () => {
    expect(normalizeSearch("Зелёный  Ёж")).toBe("зеленый еж");
  });
});
