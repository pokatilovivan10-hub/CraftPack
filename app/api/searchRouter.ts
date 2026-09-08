import { z } from "zod";
import { and, asc, eq, inArray, like, sql } from "drizzle-orm";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { products, productImages } from "@db/schema";
import { normalizeSearch } from "./import/slug";

async function attachImages<T extends { id: number }>(items: T[]) {
  if (!items.length) return items.map((x) => ({ ...x, image: null }));
  const db = getDb();
  const ids = items.map((x) => x.id);
  const images = await db.select().from(productImages).where(inArray(productImages.productId, ids));
  const map = new Map<number, (typeof images)[number]>();
  for (const img of images.sort((a, b) => a.sortOrder - b.sortOrder)) {
    if (!map.has(img.productId)) map.set(img.productId, img);
  }
  return items.map((x) => ({ ...x, image: map.get(x.id) ?? null }));
}

export const searchRouter = createRouter({
  /** Подсказки после 2–3 символов; точное совпадение артикула — выше текстовых. */
  suggest: publicQuery
    .input(z.object({ q: z.string().min(2).max(200) }))
    .query(async ({ input }) => {
      const db = getDb();
      const q = normalizeSearch(input.q);
      const items = await db
        .select()
        .from(products)
        .where(and(eq(products.active, true), like(products.searchText, `%${q}%`)))
        .orderBy(
          sql`(${products.sku} = ${input.q.trim()}) DESC`,
          sql`(${products.sku} LIKE ${input.q.trim() + "%"}) DESC`,
          asc(products.sortOrder),
          asc(products.sku),
        )
        .limit(8);
      return attachImages(items);
    }),

  search: publicQuery
    .input(
      z.object({
        q: z.string().min(1).max(200),
        page: z.number().int().min(1).default(1),
        pageSize: z.union([z.literal(24), z.literal(36)]).default(24),
      }),
    )
    .query(async ({ input }) => {
      const db = getDb();
      const q = normalizeSearch(input.q);
      const where = and(eq(products.active, true), like(products.searchText, `%${q}%`));
      const [{ n: total }] = await db
        .select({ n: sql<number>`count(*)` })
        .from(products)
        .where(where);
      const items = await db
        .select()
        .from(products)
        .where(where)
        .orderBy(
          sql`(${products.sku} = ${input.q.trim()}) DESC`,
          sql`(${products.sku} LIKE ${input.q.trim() + "%"}) DESC`,
          asc(products.sortOrder),
          asc(products.sku),
        )
        .limit(input.pageSize)
        .offset((input.page - 1) * input.pageSize);
      return {
        items: await attachImages(items),
        total: Number(total),
        page: input.page,
        pageSize: input.pageSize,
      };
    }),
});
