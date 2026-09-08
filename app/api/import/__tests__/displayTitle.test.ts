import { describe, it, expect } from "vitest";
import { displayTitle, relatedScore, dimsVolume } from "../displayTitle";
import { parseSourceDate } from "../sourceDate";

describe("displayTitle", () => {
  it("убирает размеры и упаковку, цвет — через запятую", () => {
    const r = displayTitle({
      title: "Коробка Квадратная 8*8*4 сборная Белый 1/20 1/300",
      color: "белый",
      hasDimensions: true,
    });
    expect(r.shortened).toBe(true);
    expect(r.display).toBe("Коробка квадратная сборная, белая");
  });

  it("сохраняет смысл набора и число предметов (Набор 1/3 не трогаем)", () => {
    const r = displayTitle({
      title: "Коробки Квадратные Набор 1/3 21*21*12,3 с бантиком и цветочком Серый 1/18",
      color: "серый",
      hasDimensions: true,
    });
    expect(r.display).toBe("Коробки квадратные набор 1/3 с бантиком и цветочком, серые");
  });

  it("сохраняет названия в кавычках", () => {
    const r = displayTitle({
      title: 'Коробка "Ваза для цветов" 10,6*10,7*7,2 с тиснением "Мини" Белый 1/10 1/120',
      color: "белый",
      hasDimensions: true,
    });
    expect(r.display).toBe('Коробка "Ваза для цветов" с тиснением "Мини", белая');
  });

  it("не сокращает нераспознанные товары", () => {
    const r = displayTitle({ title: "Что-то нестандартное 12*12*12", color: null, hasDimensions: false });
    expect(r.shortened).toBe(false);
    expect(r.display).toBe("Что-то нестандартное 12*12*12");
  });
});

describe("parseSourceDate", () => {
  it("парсит дату прайса из файла", () => {
    const d = parseSourceDate("2026-09-04 22:22:27");
    expect(d).toBeInstanceOf(Date);
    expect(d!.getFullYear()).toBe(2026);
    expect(d!.getMonth()).toBe(8);
    expect(d!.getDate()).toBe(4);
  });
  it("возвращает null для мусора", () => {
    expect(parseSourceDate(null)).toBeNull();
    expect(parseSourceDate("скоро")).toBeNull();
  });
});

describe("relatedScore / dimsVolume", () => {
  const base = { shape: "квадратная", color: "белый", volume: 80 * 80 * 40, categoryId: 5 };
  it("форма и цвет важнее категории", () => {
    const same = relatedScore(base, { shape: "квадратная", color: "белый", volume: 80 * 80 * 50, categoryId: 5 });
    const other = relatedScore(base, { shape: "круглая", color: "красный", volume: 99999999, categoryId: 5 });
    expect(same).toBeGreaterThan(other);
  });
  it("близкие размеры дают балл", () => {
    const near = relatedScore(base, { volume: 90 * 90 * 40, categoryId: 9 });
    const far = relatedScore(base, { volume: 500 * 500 * 500, categoryId: 9 });
    expect(near).toBeGreaterThan(far);
  });
  it("dimsVolume парсит нормализованные мм", () => {
    expect(dimsVolume("106x107x72")).toBe(106 * 107 * 72);
    expect(dimsVolume(null)).toBeNull();
    expect(dimsVolume("bad")).toBeNull();
  });
});
