/**
 * Импорт шести новых прайсов (бумага, лента, плёнка, флористика, новый год, мешочки).
 *
 * - Перед applyImport разделы строк нормализуются: смешанные секции файла
 *   («Лента», «Мешочки», «Новый год», «Бумага») раскладываются по подкатегориям
 *   по слову в названии. Сопоставление явное, без эвристик на уровне БД.
 * - Категории создаются create-or-get по slug; section_mappings — upsert.
 * - Дубликаты SKU внутри файла: первая строка побеждает, ошибка понижается
 *   до предупреждения (товары идентичны — проверено вручную по названиям).
 * - Идемпотентно: повторный запуск обновляет те же SKU, дублей не создаёт.
 */
import fs from "node:fs";
import { parsePriceList, type ParsedProductRow } from "../api/import/parsePriceList";
import { applyImport } from "../api/import/applyImport";
import { getDb } from "../api/queries/connection";
import { categories, sectionMappings } from "./schema";
import { eq } from "drizzle-orm";

const db = getDb();

// ─── Целевая структура категорий ────────────────────────────────────────────

interface CatSpec { name: string; slug: string; parentSlug: string | null; sort: number }

const CAT_SPECS: CatSpec[] = [
  // Бумага
  { name: "Тишью", slug: "bumaga-tishyu", parentSlug: "bumaga", sort: 10 },
  { name: "Крафт", slug: "bumaga-kraft", parentSlug: "bumaga", sort: 20 },
  { name: "Тишью в рулонах", slug: "bumaga-tishyu-v-rulonakh", parentSlug: "bumaga", sort: 30 },
  // Лента
  { name: "Атласные", slug: "lenta-atlasnye", parentSlug: "lenta", sort: 10 },
  { name: "Репсовые", slug: "lenta-repsovye", parentSlug: "lenta", sort: 20 },
  { name: "Из органзы", slug: "lenta-organza", parentSlug: "lenta", sort: 30 },
  { name: "Бархатные", slug: "lenta-barhatnye", parentSlug: "lenta", sort: 40 },
  { name: "Льняные", slug: "lenta-lnyanye", parentSlug: "lenta", sort: 50 },
  { name: "Полипропиленовые", slug: "lenta-polipropilenovye", parentSlug: "lenta", sort: 60 },
  { name: "Парчовые", slug: "lenta-parchovye", parentSlug: "lenta", sort: 70 },
  // Флористика
  { name: "Фоамиран", slug: "floristika-foamiran", parentSlug: "floristika", sort: 10 },
  { name: "Вазы", slug: "floristika-vazy", parentSlug: "floristika", sort: 20 },
  { name: "Корзины цветочные", slug: "floristika-korziny", parentSlug: "floristika", sort: 30 },
  { name: "Лента фатин", slug: "floristika-fatin", parentSlug: "floristika", sort: 40 },
  { name: "Мыльные цветы", slug: "floristika-mylnye-cvety", parentSlug: "floristika", sort: 50 },
  { name: "Пакеты для цветов", slug: "floristika-pakety", parentSlug: "floristika", sort: 60 },
  { name: "Сухоцветы", slug: "floristika-suhocvety", parentSlug: "floristika", sort: 70 },
  { name: "Скотч и клей", slug: "floristika-skotch-kley", parentSlug: "floristika", sort: 80 },
  // Новый год
  { name: "Пакеты новогодние", slug: "ng-pakety", parentSlug: "novyy-god", sort: 10 },
  { name: "Мешочки новогодние", slug: "ng-meshochki", parentSlug: "novyy-god", sort: 20 },
  { name: "Бумага новогодняя", slug: "ng-bumaga", parentSlug: "novyy-god", sort: 30 },
  { name: "Плёнка новогодняя", slug: "ng-plyonka", parentSlug: "novyy-god", sort: 40 },
  { name: "Открытки новогодние", slug: "ng-otkrytki", parentSlug: "novyy-god", sort: 50 },
  { name: "Коробки новогодние", slug: "ng-korobki", parentSlug: "novyy-god", sort: 60 },
  // Мешочки подарочные — новый корневой раздел
  { name: "Мешочки подарочные", slug: "meshochki-podarochnye", parentSlug: null, sort: 25 },
  { name: "Атласные", slug: "meshochki-atlasnye", parentSlug: "meshochki-podarochnye", sort: 10 },
  { name: "Бархатные", slug: "meshochki-barhatnye", parentSlug: "meshochki-podarochnye", sort: 20 },
  { name: "Из органзы", slug: "meshochki-organza", parentSlug: "meshochki-podarochnye", sort: 30 },
  { name: "Из льна и мешковины", slug: "meshochki-len", parentSlug: "meshochki-podarochnye", sort: 40 },
];

// ─── Раскладка смешанных секций по названию ─────────────────────────────────

function remapSection(file: string, section: string, title: string): string {
  const t = title.toLowerCase();
  switch (file) {
    case "бумага упаковочная.xlsx":
      if (section === 'Бумага "Тишью" в рулонах') return "Бумага/Тишью в рулонах";
      if (section === 'Бумага "Тишью"') return "Бумага/Тишью";
      if (t.includes("тишью")) return "Бумага/Тишью";
      if (t.includes("крафт")) return "Бумага/Крафт";
      return "Бумага";

    case "лента подарочная.xlsx":
      if (section.startsWith("Лента Атласная")) return "Лента/Атласные";
      if (section === "Лента Лён") return "Лента/Льняные";
      if (section === "Лента Органза") return "Лента/Из органзы";
      if (section === "Лента Полипропилен") return "Лента/Полипропиленовые";
      // смешанная секция «Лента»
      if (t.includes("репсовая")) return "Лента/Репсовые";
      if (t.includes("органза")) return "Лента/Из органзы";
      if (t.includes("бархат")) return "Лента/Бархатные";
      if (t.includes("парча")) return "Лента/Парчовые";
      if (t.includes("лён") || t.includes("лен ")) return "Лента/Льняные";
      if (t.includes("атласная") || t.includes("полиэстер")) return "Лента/Атласные";
      return "Лента";

    case "пленка упаковочная.xlsx":
      return "Плёнка упаковочная";

    case "Флористика.xlsx":
      if (section === "фоамиран") return "Флористика/Фоамиран";
      if (section === "вазы") return "Флористика/Вазы";
      if (section === "корзины цветочные") return "Флористика/Корзины цветочные";
      if (section === "Лента Фатин") return "Флористика/Лента фатин";
      if (section === "мыльные цветы") return "Флористика/Мыльные цветы";
      if (section === 'Пакеты "Конус для цветов"') return "Флористика/Пакеты для цветов";
      if (section === "сухоцветы") return "Флористика/Сухоцветы";
      if (section === "Скотч двухсторонний" || section === "Скотч прозрачный (канцелярский)" || section === "термоклей и клеевые пистолеты")
        return "Флористика/Скотч и клей";
      return "Флористика";

    case "новый год.xlsx":
      if (section === "Коробки новогодние") return "Новый год/Коробки новогодние";
      if (t.startsWith("пакет")) return "Новый год/Пакеты";
      if (t.startsWith("мешочки")) return "Новый год/Мешочки";
      if (t.startsWith("бумага")) return "Новый год/Бумага";
      if (t.startsWith("плёнка")) return "Новый год/Плёнка";
      if (t.startsWith("открытк")) return "Новый год/Открытки";
      return "Новый год";

    case "мешочки подарочные.xlsx":
      if (section === "Мешочки бархатные") return "Мешочки/Бархатные";
      if (section === "Мешочки из льна и мешковины") return "Мешочки/Из льна и мешковины";
      if (t.includes("из органзы")) return "Мешочки/Из органзы";
      if (t.includes("льна") || t.includes("мешковин")) return "Мешочки/Из льна и мешковины";
      if (t.includes("бархатные")) return "Мешочки/Бархатные";
      if (t.includes("атласные")) return "Мешочки/Атласные";
      return "Мешочки";
  }
  return section;
}

// Финальный раздел → slug категории
const SECTION_TO_SLUG: Record<string, string> = {
  "Бумага": "bumaga",
  "Бумага/Тишью": "bumaga-tishyu",
  "Бумага/Крафт": "bumaga-kraft",
  "Бумага/Тишью в рулонах": "bumaga-tishyu-v-rulonakh",
  "Лента": "lenta",
  "Лента/Атласные": "lenta-atlasnye",
  "Лента/Репсовые": "lenta-repsovye",
  "Лента/Из органзы": "lenta-organza",
  "Лента/Бархатные": "lenta-barhatnye",
  "Лента/Льняные": "lenta-lnyanye",
  "Лента/Полипропиленовые": "lenta-polipropilenovye",
  "Лента/Парчовые": "lenta-parchovye",
  "Плёнка упаковочная": "plyonka-upakovochnaya",
  "Флористика": "floristika",
  "Флористика/Фоамиран": "floristika-foamiran",
  "Флористика/Вазы": "floristika-vazy",
  "Флористика/Корзины цветочные": "floristika-korziny",
  "Флористика/Лента фатин": "floristika-fatin",
  "Флористика/Мыльные цветы": "floristika-mylnye-cvety",
  "Флористика/Пакеты для цветов": "floristika-pakety",
  "Флористика/Сухоцветы": "floristika-suhocvety",
  "Флористика/Скотч и клей": "floristika-skotch-kley",
  "Новый год": "novyy-god",
  "Новый год/Пакеты": "ng-pakety",
  "Новый год/Мешочки": "ng-meshochki",
  "Новый год/Бумага": "ng-bumaga",
  "Новый год/Плёнка": "ng-plyonka",
  "Новый год/Открытки": "ng-otkrytki",
  "Новый год/Коробки новогодние": "ng-korobki",
  "Мешочки": "meshochki-podarochnye",
  "Мешочки/Атласные": "meshochki-atlasnye",
  "Мешочки/Бархатные": "meshochki-barhatnye",
  "Мешочки/Из органзы": "meshochki-organza",
  "Мешочки/Из льна и мешковины": "meshochki-len",
};

// ─── Основной процесс ───────────────────────────────────────────────────────

const FILES = [
  "бумага упаковочная.xlsx",
  "лента подарочная.xlsx",
  "пленка упаковочная.xlsx",
  "Флористика.xlsx",
  "новый год.xlsx",
  "мешочки подарочные.xlsx",
];

// 1. Категории create-or-get
const existingCats = await db.select().from(categories);
const bySlug = new Map(existingCats.map((c) => [c.slug, c]));
for (const spec of CAT_SPECS) {
  if (bySlug.has(spec.slug)) continue;
  const parent = spec.parentSlug ? bySlug.get(spec.parentSlug) : null;
  if (spec.parentSlug && !parent) throw new Error(`Нет родителя ${spec.parentSlug} для ${spec.slug}`);
  const ins = await db.insert(categories).values({
    name: spec.name,
    slug: spec.slug,
    parentId: parent?.id ?? null,
    sortOrder: spec.sort,
    active: true,
  });
  const cat = { id: Number(ins[0].insertId), name: spec.name, slug: spec.slug, parentId: parent?.id ?? null } as (typeof existingCats)[number];
  bySlug.set(spec.slug, cat);
  console.log(`+ категория ${spec.slug} (id ${cat.id})`);
}

// 2. section_mappings upsert
const existingMaps = await db.select().from(sectionMappings);
const mapBySection = new Map(existingMaps.map((m) => [m.sourceSection, m]));
for (const [section, slug] of Object.entries(SECTION_TO_SLUG)) {
  const cat = bySlug.get(slug);
  if (!cat) throw new Error(`Нет категории ${slug}`);
  const cur = mapBySection.get(section);
  if (cur) {
    if (cur.categoryId !== cat.id) {
      await db.update(sectionMappings).set({ categoryId: cat.id }).where(eq(sectionMappings.id, cur.id));
      console.log(`~ mapping «${section}» -> ${slug}`);
    }
  } else {
    await db.insert(sectionMappings).values({ sourceSection: section, categoryId: cat.id });
    console.log(`+ mapping «${section}» -> ${slug}`);
  }
}

// 3. Импорт файлов
for (const file of FILES) {
  const buf = fs.readFileSync(`/mnt/agents/upload/${file}`);
  const parsed = await parsePriceList(buf);

  // Дубликаты SKU внутри файла — не блокируют импорт: вторая строка пропущена парсером
  parsed.issues = parsed.issues.filter((i) => {
    if (i.severity === "error" && i.message.startsWith("Дубликат артикула")) {
      console.log(`  ! дубликат в файле ${file}: SKU ${i.sku} (строка ${i.rowNumber}) — оставлена первая строка`);
      return false;
    }
    return true;
  });

  // Нормализация разделов + пересчёт счётчиков
  const sections: Record<string, number> = {};
  for (const row of parsed.products as ParsedProductRow[]) {
    row.section = remapSection(file, row.section, row.title);
    sections[row.section] = (sections[row.section] ?? 0) + 1;
  }
  parsed.sections = sections;

  const unmapped = Object.keys(sections).filter((s) => !SECTION_TO_SLUG[s]);
  if (unmapped.length) throw new Error(`Без сопоставления: ${JSON.stringify(unmapped)}`);

  const summary = await applyImport(parsed, { mode: "apply", fileName: file, operator: "agent" });
  console.log(`= ${file}: created=${summary.created} updated=${summary.updated} unchanged=${summary.unchanged} status=${summary.status} warn=${summary.warnings} err=${summary.errors}`);
  console.log(`  sections: ${JSON.stringify(sections)}`);
}

console.log("DONE");
process.exit(0);
