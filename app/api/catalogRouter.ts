import { z } from "zod";
import { and, asc, desc, eq, inArray, sql, gte, lte, like, type SQL } from "drizzle-orm";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { categories, products, productImages, productAttributes } from "@db/schema";
import { normalizeSearch } from "./import/slug";
import { displayTitle, relatedScore, dimsVolume } from "./import/displayTitle";

const SORTS = ["default", "price_asc", "price_desc", "new"] as const;
export type SortKey = (typeof SORTS)[number];

const listInput = z.object({
  categorySlug: z.string().max(512).optional(),
  q: z.string().max(200).optional(),
  sort: z.enum(SORTS).default("default"),
  page: z.number().int().min(1).max(100000).default(1),
  pageSize: z.union([z.literal(24), z.literal(36)]).default(24),
  inStock: z.boolean().optional(),
  priceMin: z.number().min(0).max(100000000).optional(),
  priceMax: z.number().min(0).max(100000000).optional(),
  // Несколько цветов: объединяются через OR, с остальными группами — AND
  colors: z.array(z.string().max(64)).max(40).optional(),
});

async function categoryDescendantIds(slug: string): Promise<number[]> {
  const db = getDb();
  const all = await db.select().from(categories);
  const target = all.find((c) => c.slug === slug);
  if (!target) return [];
  const ids = [target.id];
  let frontier = [target.id];
  while (frontier.length) {
    const children = all.filter((c) => c.parentId !== null && frontier.includes(c.parentId));
    frontier = children.map((c) => c.id);
    ids.push(...frontier);
  }
  return ids;
}

function orderClause(sort: SortKey) {
  switch (sort) {
    case "price_asc":
      // Товары без цены — всегда в конце
      return [sql`(${products.price} IS NULL) ASC`, asc(products.price), asc(products.sku)];
    case "price_desc":
      return [sql`(${products.price} IS NULL) ASC`, desc(products.price), asc(products.sku)];
    case "new":
      return [desc(products.publishedAt), asc(products.sku)];
    default:
      return [asc(products.sortOrder), asc(products.sku)];
  }
}

export const catalogRouter = createRouter({
  /** Дерево каталога: верхний уровень + дети + реальные счётчики товаров. */
  categories: publicQuery.query(async () => {
    const db = getDb();
    const all = await db.select().from(categories).where(eq(categories.active, true));
    const counts = await db
      .select({ categoryId: products.categoryId, n: sql<number>`count(*)` })
      .from(products)
      .where(eq(products.active, true))
      .groupBy(products.categoryId);
    const direct = new Map(counts.map((c) => [c.categoryId, Number(c.n)]));
    const totalFor = (id: number): number => {
      const children = all.filter((c) => c.parentId === id);
      return (direct.get(id) ?? 0) + children.reduce((s, c) => s + totalFor(c.id), 0);
    };
    return all
      .filter((c) => c.parentId === null)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((c) => ({
        ...c,
        productCount: totalFor(c.id),
        children: all
          .filter((ch) => ch.parentId === c.id)
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((ch) => ({ ...ch, productCount: totalFor(ch.id) })),
      }));
  }),

  categoryBySlug: publicQuery
    .input(z.object({ slug: z.string().max(512) }))
    .query(async ({ input }) => {
      const db = getDb();
      const all = await db.select().from(categories).where(eq(categories.active, true));
      const cat = all.find((c) => c.slug === input.slug);
      if (!cat) return null;
      const crumbs: typeof all = [];
      let cur: (typeof all)[number] | undefined = cat;
      while (cur) {
        crumbs.unshift(cur);
        cur = all.find((c) => c.id === cur!.parentId);
      }
      const children = all
        .filter((c) => c.parentId === cat.id)
        .sort((a, b) => a.sortOrder - b.sortOrder);
      return { category: cat, breadcrumbs: crumbs, children };
    }),

  productsList: publicQuery.input(listInput).query(async ({ input }) => {
    const db = getDb();

    // Базовые условия (без цены и цвета) — переиспользуются в фасетах
    const baseConds: SQL[] = [eq(products.active, true)];
    if (input.categorySlug) {
      const ids = await categoryDescendantIds(input.categorySlug);
      if (!ids.length) {
        return { items: [], total: 0, page: input.page, pageSize: input.pageSize, facets: emptyFacets() };
      }
      baseConds.push(inArray(products.categoryId, ids));
    }
    if (input.q && input.q.trim()) {
      const q = normalizeSearch(input.q);
      baseConds.push(like(products.searchText, `%${q}%`));
    }
    if (input.inStock) baseConds.push(eq(products.stockStatus, "in_stock"));

    const priceConds: SQL[] = [];
    if (input.priceMin !== undefined) priceConds.push(gte(products.price, String(input.priceMin)));
    if (input.priceMax !== undefined) priceConds.push(lte(products.price, String(input.priceMax)));

    const colorConds: SQL[] = [];
    if (input.colors?.length) {
      const idsWithColor = db
        .select({ productId: productAttributes.productId })
        .from(productAttributes)
        .where(
          and(
            eq(productAttributes.key, "color"),
            inArray(productAttributes.normalizedValue, input.colors),
          ),
        );
      colorConds.push(inArray(products.id, idsWithColor));
    }

    const where = and(...baseConds, ...priceConds, ...colorConds);
    const [{ n: total }] = await db
      .select({ n: sql<number>`count(*)` })
      .from(products)
      .where(where);

    const items = await db
      .select()
      .from(products)
      .where(where)
      .orderBy(...orderClause(input.sort))
      .limit(input.pageSize)
      .offset((input.page - 1) * input.pageSize);

    const ids = items.map((p) => p.id);
    const images = ids.length
      ? await db.select().from(productImages).where(inArray(productImages.productId, ids))
      : [];
    const imgByProduct = new Map<number, (typeof images)[number]>();
    for (const img of images.sort((a, b) => a.sortOrder - b.sortOrder)) {
      if (!imgByProduct.has(img.productId)) imgByProduct.set(img.productId, img);
    }

    // Фасеты: каждая группа учитывает ОСТАЛЬНЫЕ выбранные группы, но не саму себя —
    // числа не обещают невозможный результат.
    // Диапазон цен: с учётом цвета/наличия/категории/поиска, без ценового фильтра.
    const priceFacetWhere = and(...baseConds, ...colorConds);
    const [priceAgg] = await db
      .select({
        min: sql<string | null>`min(${products.price})`,
        max: sql<string | null>`max(${products.price})`,
      })
      .from(products)
      .where(priceFacetWhere);
    // Цвета: с учётом цены/наличия/категории/поиска, без цветового фильтра.
    // У товара может быть несколько строк цвета (inferred + подтверждённый source) —
    // фасет считает товар один раз по лучшей строке (manual > source > inferred).
    // Порядок стабилен: по убыванию счётчика, при равенстве — по алфавиту.
    const colorFacetWhere = and(...baseConds, ...priceConds);
    const bestColor = sql.raw(`(select pa2.normalized_value from product_attributes pa2 where pa2.product_id = products.id and pa2.\`key\` = 'color' order by case pa2.source when 'manual' then 3 when 'source' then 2 else 1 end, pa2.id limit 1)`);
    const colorRows = await db
      .select({ v: sql<string | null>`${bestColor}`.as("v"), n: sql<number>`count(*)` })
      .from(products)
      .where(and(colorFacetWhere, sql`${bestColor} is not null`))
      .groupBy(sql`${bestColor}`)
      .orderBy(desc(sql`count(*)`), asc(sql`${bestColor}`))
      .limit(200);

    return {
      items: items.map((p) => ({ ...p, image: imgByProduct.get(p.id) ?? null })),
      total: Number(total),
      page: input.page,
      pageSize: input.pageSize,
      facets: {
        priceMin: priceAgg?.min ? parseFloat(priceAgg.min) : null,
        priceMax: priceAgg?.max ? parseFloat(priceAgg.max) : null,
        colors: colorRows
          .filter((c) => c.v)
          .map((c) => ({ value: c.v as string, count: Number(c.n) })),
      },
    };
  }),

  productBySlug: publicQuery
    .input(z.object({ slug: z.string().max(512) }))
    .query(async ({ input }) => {
      const db = getDb();
      const [p] = await db.select().from(products).where(eq(products.slug, input.slug));
      if (!p) return null;
      const images = await db
        .select()
        .from(productImages)
        .where(eq(productImages.productId, p.id))
        .orderBy(asc(productImages.sortOrder));
      const attrs = await db
        .select()
        .from(productAttributes)
        .where(eq(productAttributes.productId, p.id));
      const breadcrumbs: (typeof categories.$inferSelect)[] = [];
      if (p.categoryId) {
        const all = await db.select().from(categories);
        let cur = all.find((c) => c.id === p.categoryId);
        while (cur) {
          breadcrumbs.unshift(cur);
          cur = all.find((c) => c.id === cur!.parentId);
        }
      }
      // Дедупликация по ключу с учётом происхождения: ручные правки > подтверждённые
      // данными старого сайта (source) > распознанные из названия (inferred)
      const ATTR_SOURCE_PRI: Record<string, number> = { manual: 3, source: 2, inferred: 1 };
      const byKey = new Map<string, (typeof attrs)[number]>();
      for (const a of attrs) {
        const cur = byKey.get(a.key);
        if (!cur || (ATTR_SOURCE_PRI[a.source] ?? 0) > (ATTR_SOURCE_PRI[cur.source] ?? 0)) {
          byKey.set(a.key, a);
        }
      }

      // Единица продажи и фасовка — показываем только подтверждённые (не inferred)
      const confirmed = (key: string) => {
        const a = byKey.get(key);
        return a && a.source !== "inferred" ? a : null;
      };
      const qty = (key: string) => {
        const a = confirmed(key);
        if (!a) return null;
        const n = Number.parseInt(a.value, 10);
        return Number.isFinite(n) && n > 0 ? { qty: n, unit: a.unit ?? "шт." } : null;
      };
      const units = {
        unitSale: confirmed("unitSale")?.value ?? null,
        pack: qty("packQty"),
        box: qty("boxQty"),
      };

      // Таблица характеристик: служебные ключи фасовки не показываем;
      // сырую строку packing («1/20 1/240») скрываем, когда фасовка подтверждена
      const SERVICE_KEYS = new Set(["unitSale", "packQty", "boxQty"]);
      const ATTR_ORDER = [
        "dimensions", "shape", "color", "material", "construction",
        "finish", "design", "purpose", "set_count", "packing",
      ];
      const tableAttrs = [...byKey.values()]
        .filter((a) => !SERVICE_KEYS.has(a.key))
        .filter((a) => !(a.key === "packing" && (units.pack || units.box)))
        .sort((x, y) => {
          const ix = ATTR_ORDER.indexOf(x.key);
          const iy = ATTR_ORDER.indexOf(y.key);
          return (ix === -1 ? 99 : ix) - (iy === -1 ? 99 : iy);
        });
      const hasInferred = tableAttrs.some((a) => a.source === "inferred");

      // Понятное название для интерфейса; исходное sourceTitle не меняется
      const color = byKey.get("color")?.normalizedValue ?? null;
      const dims = byKey.get("dimensions");
      const dt = displayTitle({ title: p.title, color, hasDimensions: !!dims });
      return {
        product: p,
        images,
        attributes: tableAttrs,
        hasInferredAttributes: hasInferred,
        units,
        breadcrumbs,
        displayTitle: dt.display,
        displayDims: dims?.value ?? null,
      };
    }),

  relatedProducts: publicQuery
    .input(z.object({ productId: z.number().int(), limit: z.number().int().min(1).max(12).default(8) }))
    .query(async ({ input }) => {
      const db = getDb();
      const [p] = await db.select().from(products).where(eq(products.id, input.productId));
      if (!p) return [];
      // Ранжирование по назначению/форме/размерам/цвету, затем по категории
      const baseAttrs = await db
        .select()
        .from(productAttributes)
        .where(eq(productAttributes.productId, p.id));
      const attrOf = (key: string) => baseAttrs.find((a) => a.key === key)?.normalizedValue ?? null;
      const base = {
        shape: attrOf("shape"),
        color: attrOf("color"),
        volume: dimsVolume(attrOf("dimensions")),
        categoryId: p.categoryId,
      };

      // Кандидаты: тот же раздел каталога (с учётом детей), активные
      const allCats = await db.select().from(categories);
      let catIds: number[] = [];
      if (p.categoryId) {
        const target = allCats.find((c) => c.id === p.categoryId);
        if (target) catIds = await categoryDescendantIds(target.slug);
      }
      const candidates = await db
        .select()
        .from(products)
        .where(
          and(
            catIds.length ? inArray(products.categoryId, catIds) : undefined,
            eq(products.active, true),
            sql`${products.id} <> ${p.id}`,
          ),
        )
        .orderBy(asc(products.sortOrder), asc(products.sku))
        .limit(400);
      const candIds = candidates.map((x) => x.id);
      const candAttrs = candIds.length
        ? await db
            .select()
            .from(productAttributes)
            .where(inArray(productAttributes.productId, candIds))
        : [];
      const attrsByProduct = new Map<number, typeof candAttrs>();
      for (const a of candAttrs) {
        const arr = attrsByProduct.get(a.productId) ?? [];
        arr.push(a);
        attrsByProduct.set(a.productId, arr);
      }

      const scored = candidates
        .map((c) => {
          const ca = attrsByProduct.get(c.id) ?? [];
          const get = (key: string) => ca.find((a) => a.key === key)?.normalizedValue ?? null;
          return {
            item: c,
            score: relatedScore(base, {
              shape: get("shape"),
              color: get("color"),
              volume: dimsVolume(get("dimensions")),
              categoryId: c.categoryId,
            }),
          };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, input.limit);

      const items = scored.map((s) => s.item);
      const ids = items.map((x) => x.id);
      const images = ids.length
        ? await db.select().from(productImages).where(inArray(productImages.productId, ids))
        : [];
      const imgByProduct = new Map<number, (typeof images)[number]>();
      for (const img of images.sort((a, b) => a.sortOrder - b.sortOrder)) {
        if (!imgByProduct.has(img.productId)) imgByProduct.set(img.productId, img);
      }
      return items.map((x) => ({ ...x, image: imgByProduct.get(x.id) ?? null }));
    }),

  /**
   * Витрина «В наличии» на главной: управляемый, детерминированный порядок —
   * round-robin по разделам прайса, чтобы витрина не вырождалась
   * в визуально одинаковые товары одной группы.
   */
  featured: publicQuery
    .input(z.object({ limit: z.number().int().min(1).max(24).default(8) }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      const limit = input?.limit ?? 8;
      const pool = await db
        .select()
        .from(products)
        .where(and(eq(products.active, true), eq(products.stockStatus, "in_stock")))
        .orderBy(asc(products.sourceSection), asc(products.sortOrder), asc(products.sku))
        .limit(2000);
      const bySection = new Map<string, typeof pool>();
      for (const p of pool) {
        const key = p.sourceSection ?? "";
        const arr = bySection.get(key) ?? [];
        arr.push(p);
        bySection.set(key, arr);
      }
      const sections = [...bySection.values()].filter((a) => a.length);
      const picked: typeof pool = [];
      let i = 0;
      while (picked.length < limit && sections.some((a) => a.length)) {
        const arr = sections[i % sections.length];
        if (arr.length) picked.push(arr.shift()!);
        i++;
      }
      const ids = picked.map((x) => x.id);
      const images = ids.length
        ? await db.select().from(productImages).where(inArray(productImages.productId, ids))
        : [];
      const imgByProduct = new Map<number, (typeof images)[number]>();
      for (const img of images.sort((a, b) => a.sortOrder - b.sortOrder)) {
        if (!imgByProduct.has(img.productId)) imgByProduct.set(img.productId, img);
      }
      return picked.map((x) => ({ ...x, image: imgByProduct.get(x.id) ?? null }));
    }),

  /** Товары по SKU — для серверной валидации корзины и сравнения. */
  bySkus: publicQuery
    .input(z.object({ skus: z.array(z.string().max(64)).max(200) }))
    .query(async ({ input }) => {
      if (!input.skus.length) return [];
      const db = getDb();
      const items = await db
        .select()
        .from(products)
        .where(and(inArray(products.sku, input.skus), eq(products.active, true)));
      const ids = items.map((x) => x.id);
      const images = ids.length
        ? await db.select().from(productImages).where(inArray(productImages.productId, ids))
        : [];
      const imgByProduct = new Map<number, (typeof images)[number]>();
      for (const img of images.sort((a, b) => a.sortOrder - b.sortOrder)) {
        if (!imgByProduct.has(img.productId)) imgByProduct.set(img.productId, img);
      }
      const attrs = ids.length
        ? await db.select().from(productAttributes).where(inArray(productAttributes.productId, ids))
        : [];
      return items.map((x) => ({
        ...x,
        image: imgByProduct.get(x.id) ?? null,
        attributes: attrs.filter((a) => a.productId === x.id),
      }));
    }),
});

function emptyFacets() {
  return { priceMin: null as number | null, priceMax: null as number | null, colors: [] as { value: string; count: number }[] };
}
