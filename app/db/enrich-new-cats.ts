/**
 * Обогащение новых категорий (бумага/лента/плёнка/флористика/новый год/мешочки)
 * данными старого сайта kraftpak.shop:
 * 1. Фото: оригиналы 750/970 px вместо миниатюр XLSX (старые строки сохраняются
 *    со sortOrder+10 для отката; новые — sourcePriority=50).
 * 2. Атрибуты: подтверждённые характеристики (source="source") с явным
 *    сопоставлением русских названий полей в канонические ключи.
 * 3. Чистка: inferred-размеры, ошибочно распознанные в метровых/ярдовых названиях
 *    («0,57*10м», «2,5см*25ярд»), удаляются.
 * Идемпотентно. Вход: /tmp/oldsite2/manifest.json.
 * Отчёт: /mnt/agents/output/отчёт-замены-фото-новые-категории.json
 */
import fs from "node:fs";
import { getDb } from "../api/queries/connection";
import { products, productImages, productAttributes } from "./schema";
import { and, eq, inArray, sql } from "drizzle-orm";

interface ManifestRow {
  sku: string;
  matched: boolean;
  permalink?: string;
  imageUrl?: string;
  declaredWidth?: number;
  image?: { hash: string; width: number; height: number; ext: string; bytes: number; renamed?: boolean };
  attributes?: [string, string][];
}

const OLDSITE_PRIORITY = 50;
const db = getDb();
const manifest = JSON.parse(fs.readFileSync("/tmp/oldsite2/manifest.json", "utf-8")) as ManifestRow[];

// ─── Сопоставление атрибутов старого сайта ──────────────────────────────────

const UNIT_SALE: Record<string, string> = {
  "штуку": "шт.",
  "штука": "шт.",
  "упаковку": "упак.",
  "набор": "набор",
  "метр": "м",
  "рулон": "рулон",
};

const CANON: Record<string, string> = {
  "Цвет": "color",
  "Дизайн": "design",
  "Материал": "material",
  "Материал ленты": "material",
  "Материал корзины": "material",
  "Материал пакета": "material",
  "Назначение": "purpose",
  "Назначение ленты": "purpose",
  "Назначение корзины": "purpose",
  "Назначение пакета": "purpose",
  "Форма": "shape",
  "Форма корзины": "shape",
  "Отделка": "finish",
  "Отделка пакета": "finish",
  "Конструкция": "construction",
  "Конструкция пакета": "construction",
};

function fmtNum(v: string): string {
  return v.replace(/(\d)\.(\d)/g, "$1,$2");
}

function mapAttribute(label: string, value: string): { key: string; value: string; unit: string | null; normalized: string } | null {
  const v = value.trim();
  if (!v) return null;

  if (label === "Цена за") {
    const u = UNIT_SALE[v.toLowerCase()] ?? v;
    return { key: "unitSale", value: u, unit: null, normalized: u.toLowerCase() };
  }
  if (label === "В упаковке, шт.") return { key: "packQty", value: v, unit: "шт.", normalized: v };
  if (label === "В коробке, шт.") return { key: "boxQty", value: v, unit: "шт.", normalized: v };
  if (label === "В коробке, упак.") return { key: "boxQty", value: v, unit: "упак.", normalized: v };
  if (label === "В коробке, наборов") return { key: "boxQty", value: v, unit: "наборов", normalized: v };
  if (label === "В наборе, шт.") return { key: "set_count", value: `${fmtNum(v)} шт.`, unit: null, normalized: v };

  const canon = CANON[label];
  if (canon === "color") return { key: "color", value: v, unit: null, normalized: v.toLowerCase() };
  if (canon) return { key: canon, value: v, unit: null, normalized: v.toLowerCase() };

  // «Ширина, см» → ключ «Ширина», значение «2,5 см»
  const um = label.match(/^(.+?),\s*(см|м|мкм|г|г\/ярд|г\/м2|ярд)$/);
  if (um) {
    const unit = um[2] === "г/м2" ? "г/м²" : um[2];
    return { key: um[1], value: `${fmtNum(v)} ${unit}`, unit, normalized: fmtNum(v).toLowerCase() };
  }
  return { key: label, value: v, unit: null, normalized: v.toLowerCase() };
}

// ─── Основной цикл ──────────────────────────────────────────────────────────

const skus = manifest.map((m) => m.sku);
const dbProducts = await db.select().from(products).where(inArray(products.sku, skus));
const prodBySku = new Map(dbProducts.map((p) => [p.sku, p]));

let imgUpgraded = 0, imgAlready = 0, attrInserted = 0, attrProducts = 0, dimsCleaned = 0;
const report: unknown[] = [];

let rowIdx = 0;
for (const row of manifest) {
  if (++rowIdx % 50 === 0) console.error(`progress ${rowIdx}/${manifest.length} sku=${row.sku}`);
  const prod = prodBySku.get(row.sku);
  if (!prod) {
    report.push({ sku: row.sku, status: "no_product_in_db", manualReview: true });
    continue;
  }

  // ── Фото ──
  let imageStatus = "not_matched";
  if (row.matched && row.image) {
    const img = row.image;
    const storageKey = `uploads/products/${img.hash}.${img.ext}`;
    const variantKey = img.width > 480 ? `uploads/products/${img.hash}_480.jpg` : null;
    if (!fs.existsSync(`public/${storageKey}`)) {
      imageStatus = "file_missing";
    } else {
      const existing = await db.select().from(productImages).where(eq(productImages.productId, prod.id));
      if (existing.some((i) => i.hash === img.hash)) {
        imageStatus = "already";
        imgAlready++;
      } else {
        for (const old of existing) {
          if (old.sortOrder < 10) {
            await db.update(productImages).set({ sortOrder: old.sortOrder + 10 }).where(eq(productImages.id, old.id));
          }
        }
        await db.insert(productImages).values({
          productId: prod.id,
          storageKey,
          hash: img.hash,
          alt: null,
          width: img.width,
          height: img.height,
          sourcePriority: OLDSITE_PRIORITY,
          variants: variantKey && fs.existsSync(`public/${variantKey}`) ? { "480": variantKey } : null,
          sortOrder: 0,
        });
        imageStatus = "upgraded";
        imgUpgraded++;
      }
    }
  }

  // ── Атрибуты ──
  let attrsInserted = 0;
  if (row.matched && row.attributes?.length) {
    const mapped: { key: string; value: string; unit: string | null; normalized: string }[] = [];
    const seen = new Set<string>();
    for (const [label, value] of row.attributes) {
      const m = mapAttribute(label, value);
      if (!m || seen.has(m.key)) continue;
      seen.add(m.key);
      mapped.push(m);
    }
    if (mapped.length) {
      await db
        .delete(productAttributes)
        .where(and(eq(productAttributes.productId, prod.id), eq(productAttributes.source, "source")));
      await db.insert(productAttributes).values(
        mapped.map((m) => ({
          productId: prod.id,
          key: m.key,
          value: m.value,
          normalizedValue: m.normalized,
          unit: m.unit,
          source: "source" as const,
          confidence: 95,
        })),
      );
      attrsInserted = mapped.length;
      attrInserted += mapped.length;
      attrProducts++;
    }
  }

  // ── Чистка ошибочных inferred-размеров (метры/ярды в названии) ──
  const t = prod.title;
  if (/\d\s*м\b/i.test(t) || /ярд/i.test(t)) {
    const del = await db.execute(
      sql`delete from product_attributes where product_id = ${prod.id} and \`key\` = 'dimensions' and source = 'inferred'`,
    );
    const affected = (del[0] as unknown as { affectedRows?: number }).affectedRows ?? 0;
    if (affected > 0) dimsCleaned += affected;
  }

  report.push({
    sku: row.sku,
    sourcePage: row.permalink ?? null,
    oldImage: row.imageUrl ? { url: row.imageUrl, declaredWidth: row.declaredWidth } : null,
    newImage: row.image ? { storageKey: `uploads/products/${row.image.hash}.${row.image.ext}`, width: row.image.width, height: row.image.height, renamed: row.image.renamed ?? false } : null,
    imageStatus,
    attributesImported: attrsInserted,
    checkedAt: "2026-09-08",
    manualReview: !row.matched,
    ...(row.matched ? {} : { skipReason: "SKU отсутствует на старом сайте" }),
  });
}

// Пересортировка: у каждого товара sortOrder=0 — самое приоритетное фото
await db.execute(sql`
  update product_images pi
  join (
    select product_id, min(source_priority) as mp from product_images group by product_id
  ) t on t.product_id = pi.product_id
  set pi.sort_order = 10
  where pi.source_priority > t.mp and pi.sort_order = 0
`);

fs.writeFileSync(
  "/mnt/agents/output/отчёт-замены-фото-новые-категории.json",
  JSON.stringify(
    {
      summary: {
        matched: manifest.filter((m) => m.matched).length,
        notMatched: manifest.filter((m) => !m.matched).map((m) => m.sku),
        imagesUpgraded: imgUpgraded,
        imagesAlreadyPresent: imgAlready,
        productsWithAttributes: attrProducts,
        attributesInserted: attrInserted,
        wrongDimsCleaned: dimsCleaned,
      },
      rows: report,
    },
    null,
    1,
  ),
);

console.log(JSON.stringify({ imgUpgraded, imgAlready, attrProducts, attrInserted, dimsCleaned }));
console.log("DONE");
process.exit(0);
