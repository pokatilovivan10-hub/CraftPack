/**
 * Обогащение каталога данными старого сайта kraftpak.shop (итерация 3, раздел D/E).
 *
 * Что делает:
 * 1. Перепривязывает изображения: оригиналы 750/970 px вместо миниатюр 96×96.
 *    Старые строки product_images НЕ удаляются (sortOrder=10) — возможен откат.
 *    Новые строки получают sourcePriority=50, что защищает их от затирания
 *    миниатюрами при повторном импорте XLSX.
 * 2. Импортирует подтверждённые характеристики (source="source") только для
 *    точно сопоставленных SKU — не распространяет на весь ассортимент.
 * 3. Восстанавливает вложенность категорий по явному сопоставлению
 *    (лист старого сайта → наш второй/третий уровень).
 *
 * Идемпотентно: повторный запуск не создаёт дублей.
 * Вход: /tmp/oldsite/enrichment.json (собран отдельным сборщиком).
 */
import fs from "node:fs";
import { getDb } from "../api/queries/connection";
import { categories, products, productImages, productAttributes } from "./schema";
import { and, eq, inArray } from "drizzle-orm";
import { slugify } from "../api/import/slug";

interface EnrichRow {
  sku: string;
  productId: number;
  oldPermalink: string;
  oldImageUrl: string;
  declaredWidth: number;
  image: { hash: string; width: number; height: number; ext: string; bytes: number };
  attributes: { key: string; value: string; unit: string | null }[];
  oldLeaf: string | null;
}

const XLSX_PRIORITY = 10;
const OLDSITE_PRIORITY = 50;

/** Явное сопоставление: тип листа старого сайта → наш slug второго уровня. */
const TYPE_TO_SLUG: Record<string, string> = {
  наборы: "nabory",
  одиночные: "odinochnye",
  ювелирные: "yuvelirnye",
  новогодние: "novogodnie",
};

const db = getDb();
const payload = JSON.parse(fs.readFileSync("/tmp/oldsite/enrichment.json", "utf-8")) as EnrichRow[];

const allCats = await db.select().from(categories);
const catBySlug = new Map(allCats.map((c) => [c.slug, c]));
const korobki = catBySlug.get("korobki");
if (!korobki) throw new Error("Категория korobki не найдена");

async function ensureCategory(name: string, slug: string, parentId: number, sortOrder: number) {
  const existing = catBySlug.get(slug);
  if (existing) return existing;
  const inserted = await db
    .insert(categories)
    .values({ name, slug, parentId, sortOrder, active: true });
  const id = Number(inserted[0].insertId);
  const cat = { id, name, slug, parentId, sortOrder, active: true } as (typeof allCats)[number];
  catBySlug.set(slug, cat);
  return cat;
}

function parseLeaf(leaf: string | null): { type: string | null; shape: string | null } {
  if (!leaf) return { type: null, shape: null };
  if (leaf === "Коробки новогодние") return { type: "новогодние", shape: null };
  if (leaf === "Коробки ювелирные") return { type: "ювелирные", shape: null };
  const m = leaf.match(/^Коробки (наборы|одиночные)\s+(.+)$/);
  if (!m) return { type: null, shape: null };
  let shape = m[2].trim();
  // Кавычки в названиях вида «"Сердце"» убираем для отображения
  shape = shape.replace(/^["«]|["»]$/g, "");
  return { type: m[1], shape };
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

let imgUpgraded = 0;
let imgAlready = 0;
let attrProducts = 0;
let attrInserted = 0;
let reassignedSecond = 0;
let assignedThird = 0;
const report: unknown[] = [];

for (const row of payload) {
  // ── 1. Изображение ──────────────────────────────────────────────────────
  const storageKey = `uploads/products/${row.image.hash}.${row.image.ext}`;
  const existing = await db
    .select()
    .from(productImages)
    .where(eq(productImages.productId, row.productId));
  const hasNew = existing.some((i) => i.hash === row.image.hash);
  let imgStatus: string;
  if (hasNew) {
    imgAlready++;
    imgStatus = "already";
  } else {
    // Старые строки сохраняем для отката, уводя их с первой позиции
    for (const img of existing) {
      if (img.sortOrder < 10) {
        await db.update(productImages).set({ sortOrder: img.sortOrder + 10 }).where(eq(productImages.id, img.id));
      }
    }
    await db.insert(productImages).values({
      productId: row.productId,
      storageKey,
      hash: row.image.hash,
      alt: null,
      width: row.image.width,
      height: row.image.height,
      sourcePriority: OLDSITE_PRIORITY,
      sortOrder: 0,
    });
    imgUpgraded++;
    imgStatus = "upgraded";
  }

  // ── 2. Атрибуты (только точно сопоставленные SKU) ───────────────────────
  if (row.attributes.length) {
    await db
      .delete(productAttributes)
      .where(and(eq(productAttributes.productId, row.productId), eq(productAttributes.source, "source")));
    await db.insert(productAttributes).values(
      row.attributes.map((a) => ({
        productId: row.productId,
        key: a.key,
        value: a.value,
        normalizedValue: a.key === "color" ? a.value.toLowerCase() : a.value.toLowerCase(),
        unit: a.unit,
        source: "source" as const,
        confidence: 95,
      })),
    );
    attrProducts++;
    attrInserted += row.attributes.length;
  }

  // ── 3. Таксономия ───────────────────────────────────────────────────────
  const [prod] = await db.select().from(products).where(eq(products.id, row.productId));
  const currentCat = prod?.categoryId ? catBySlug.get([...catBySlug.values()].find((c) => c.id === prod.categoryId)?.slug ?? "") : null;
  const { type, shape } = parseLeaf(row.oldLeaf);
  let targetId: number | null = null;
  let secondSlug: string | null = null;

  if (currentCat && currentCat.parentId === korobki.id) {
    // Уже во втором уровне (классификация прайса) — добавляем третий уровень по форме
    secondSlug = currentCat.slug;
  } else if (type && TYPE_TO_SLUG[type]) {
    // Прямой потомок «Коробки» без второго уровня — восстанавливаем по старому сайту
    const names: Record<string, string> = { nabory: "Наборы", odinochnye: "Одиночные", yuvelirnye: "Ювелирные", novogodnie: "Новогодние" };
    const slug = TYPE_TO_SLUG[type];
    const cat = await ensureCategory(names[slug], slug, korobki.id, 10);
    secondSlug = slug;
    targetId = cat.id;
    reassignedSecond++;
  }

  if (secondSlug && shape) {
    const thirdSlug = `${secondSlug}-${slugify(shape)}`;
    const third = await ensureCategory(capitalize(shape), thirdSlug, catBySlug.get(secondSlug)!.id, 10);
    targetId = third.id;
    assignedThird++;
  }

  if (targetId && prod && prod.categoryId !== targetId) {
    await db.update(products).set({ categoryId: targetId }).where(eq(products.id, row.productId));
  }

  report.push({
    sku: row.sku,
    sourcePage: row.oldPermalink,
    oldImage: { url: row.oldImageUrl, declaredWidth: row.declaredWidth },
    newImage: { storageKey, width: row.image.width, height: row.image.height },
    imageStatus: imgStatus,
    attributesImported: row.attributes.length,
    oldLeaf: row.oldLeaf,
    checkedAt: "2026-09-07",
    manualReview: false,
  });
}

// Несовпавший SKU — в ручную проверку
report.push({
  sku: "7201321/1",
  sourcePage: null,
  oldImage: null,
  newImage: null,
  imageStatus: "not_matched",
  attributesImported: 0,
  oldLeaf: null,
  checkedAt: "2026-09-07",
  manualReview: true,
  skipReason: "SKU отсутствует на старом сайте (поиск по артикулу и названию не дал результата)",
});

fs.writeFileSync(
  "/mnt/agents/output/отчёт-замены-фото.json",
  JSON.stringify(
    {
      summary: {
        matched: payload.length,
        notMatched: 1,
        imagesUpgraded: imgUpgraded,
        imagesAlreadyPresent: imgAlready,
        productsWithAttributes: attrProducts,
        attributesInserted: attrInserted,
        reassignedToSecondLevel: reassignedSecond,
        assignedToThirdLevel: assignedThird,
      },
      rows: report,
    },
    null,
    1,
  ),
);

console.log("Изображения улучшены:", imgUpgraded, "| уже были:", imgAlready);
console.log("Товаров с атрибутами:", attrProducts, "| атрибутов вставлено:", attrInserted);
console.log("Перемещено во 2-й уровень:", reassignedSecond, "| в 3-й уровень:", assignedThird);
process.exit(0);
