/**
 * Seed: верхнеуровневая таксономия, сопоставления разделов прайса,
 * контентные страницы-заготовки и первый импорт sample-файла.
 * Запуск: npx tsx db/seed.ts
 */
import fs from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { getDb } from "../api/queries/connection";
import { categories, sectionMappings, contentPages } from "./schema";
import { parsePriceList } from "../api/import/parsePriceList";
import { applyImport } from "../api/import/applyImport";

const TOP_LEVEL: Array<{ name: string; slug: string; sortOrder: number }> = [
  { name: "Пакеты", slug: "pakety", sortOrder: 10 },
  { name: "Плёнка упаковочная", slug: "plyonka-upakovochnaya", sortOrder: 20 },
  { name: "Флористика", slug: "floristika", sortOrder: 30 },
  { name: "Лента", slug: "lenta", sortOrder: 40 },
  { name: "Коробки", slug: "korobki", sortOrder: 50 },
  { name: "Конверты подарочные", slug: "konverty-podarochnye", sortOrder: 60 },
  { name: "Бумага", slug: "bumaga", sortOrder: 70 },
  { name: "Детские товары", slug: "detskie-tovary", sortOrder: 80 },
  { name: "Для маркетплейсов", slug: "dlya-marketpleysov", sortOrder: 90 },
  { name: "Новый год", slug: "novyy-god", sortOrder: 100 },
  { name: "Наша продукция с Вашим логотипом", slug: "produktsiya-s-logotipom", sortOrder: 110 },
  { name: "Наполнитель", slug: "napolnitel", sortOrder: 120 },
  { name: "Новинки", slug: "novinki", sortOrder: 130 },
  { name: "Свечи", slug: "svechi", sortOrder: 140 },
  { name: "Шарики воздушные", slug: "shariki-vozdushnye", sortOrder: 150 },
];

// Раздел «Новинка» старого сайта объединён в канонический «Новинки» (301/alias).
const URL_REDIRECTS: Array<{ from: string; to: string }> = [
  { from: "/catalog/novinka", to: "/catalog/novinki" },
];

const SECTION_TO_CATEGORY: Array<{ section: string; slug: string; parent?: string }> = [
  { section: "Коробки", slug: "korobki" },
  { section: "Коробки наборы", slug: "korobki/nabory", parent: "korobki" },
  { section: "Коробки одиночные", slug: "korobki/odinochnye", parent: "korobki" },
  { section: "Коробки ювелирные", slug: "korobki/yuvelirnye", parent: "korobki" },
];

const PAGES: Array<{ slug: string; title: string; content: string }> = [
  {
    slug: "delivery-payment",
    title: "Оплата и доставка",
    content:
      "Способы оплаты, сроки и стоимость доставки зависят от состава заказа и региона. " +
      "Менеджер подтвердит условия при расчёте заказа — оставьте заявку или позвоните нам.",
  },
  {
    slug: "privacy-policy",
    title: "Политика конфиденциальности",
    content:
      "Текст политики обработки персональных данных согласуется и будет опубликован на этой странице. " +
      "Текущая версия сайта работает в демонстрационном режиме: данные из форм сохраняются в тестовую базу " +
      "и используются только для проверки работы сервиса, менеджеру не пересылаются.",
  },
  {
    slug: "requisites",
    title: "Реквизиты",
    content:
      "Реквизиты компании будут опубликованы после предоставления их заказчиком. " +
      "Для оформления документов к заказу свяжитесь с менеджером.",
  },
];

async function main() {
  const db = getDb();

  // 1. Категории верхнего уровня
  const idBySlug = new Map<string, number>();
  for (const c of TOP_LEVEL) {
    const existing = await db.select().from(categories).where(eq(categories.slug, c.slug));
    if (existing.length) {
      idBySlug.set(c.slug, existing[0].id);
      continue;
    }
    const res = await db.insert(categories).values({
      name: c.name,
      slug: c.slug,
      sortOrder: c.sortOrder,
      active: true,
    });
    idBySlug.set(c.slug, Number(res[0].insertId));
  }

  // 2. Подкатегории из разделов прайса
  const subNames: Record<string, string> = {
    "korobki/nabory": "Наборы",
    "korobki/odinochnye": "Одиночные",
    "korobki/yuvelirnye": "Ювелирные",
  };
  for (const m of SECTION_TO_CATEGORY) {
    if (!m.parent) continue;
    const existing = await db.select().from(categories).where(eq(categories.slug, m.slug));
    if (existing.length) {
      idBySlug.set(m.slug, existing[0].id);
      continue;
    }
    const res = await db.insert(categories).values({
      name: subNames[m.slug] ?? m.slug,
      slug: m.slug,
      parentId: idBySlug.get(m.parent)!,
      sortOrder: 10,
      active: true,
    });
    idBySlug.set(m.slug, Number(res[0].insertId));
  }

  // 3. Сопоставления разделов прайс-листа с категориями
  for (const m of SECTION_TO_CATEGORY) {
    const categoryId = idBySlug.get(m.slug)!;
    const existing = await db
      .select()
      .from(sectionMappings)
      .where(eq(sectionMappings.sourceSection, m.section));
    if (existing.length) continue;
    await db.insert(sectionMappings).values({ sourceSection: m.section, categoryId });
  }

  // 4. Контентные страницы-заготовки
  for (const p of PAGES) {
    const existing = await db.select().from(contentPages).where(eq(contentPages.slug, p.slug));
    if (!existing.length) {
      await db.insert(contentPages).values(p);
    }
  }

  // 5. Импорт sample-файла (идемпотентно: checksum защищает от дублей)
  const samplePath = path.resolve(process.cwd(), "samples/коробки подарочные.xlsx");
  if (fs.existsSync(samplePath)) {
    const buf = fs.readFileSync(samplePath);
    const parsed = await parsePriceList(buf);
    const summary = await applyImport(parsed, {
      mode: "apply",
      fileName: "коробки подарочные.xlsx",
      operator: "seed",
    });
    console.log("Импорт завершён:", JSON.stringify({
      batchId: summary.batchId,
      status: summary.status,
      totalRows: summary.totalRows,
      created: summary.created,
      updated: summary.updated,
      unchanged: summary.unchanged,
      warnings: summary.warnings,
      errors: summary.errors,
      sections: summary.sections,
      priceDate: summary.priceDate,
      duplicateOf: summary.duplicateOfBatchId,
    }, null, 2));
  } else {
    console.warn("Sample-файл не найден, импорт пропущен:", samplePath);
  }

  console.log("Seed завершён. Редиректы для миграции URL:", URL_REDIRECTS);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
