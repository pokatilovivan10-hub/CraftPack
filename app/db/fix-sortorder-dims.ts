/**
 * Одноразовый фикс после обогащения:
 * 1. sort_order фото: лучшее (max source_priority) → 0, остальные → 10.
 *    Прежний финальный UPDATE ошибочно брал min(priority) за лучший.
 * 2. Удаление ошибочных inferred-размеров у товаров с метрами/ярдами
 *    в названии («1*10м», «2,5см*25ярд»). JS-regex \b не работает после
 *    кириллицы, поэтому фильтрация здесь — в JS с (?![а-яё]).
 */
import { getDb } from "../api/queries/connection";
import { products, productAttributes } from "./schema";
import { and, eq, inArray, sql } from "drizzle-orm";

const db = getDb();

// ─── 1. Пересортировка фото по лучшему приоритету ───────────────────────────
// Лучший приоритет (max source_priority) → sort_order 0, остальные → 10.
// Идемпотентно. Приоритеты: xlsx=10 < oldsite=50 < manual=90.
await db.execute(sql`
  update product_images pi
  join (
    select product_id, max(source_priority) as mp from product_images group by product_id
  ) t on t.product_id = pi.product_id
  set pi.sort_order = case when pi.source_priority = t.mp then 0 else 10 end
`);

// ─── 2. Чистка inferred-размеров у метровых/ярдовых названий ────────────────
const rows = await db.select({ id: products.id, sku: products.sku, title: products.title }).from(products);
const badIds: number[] = [];
for (const r of rows) {
  const t = r.title;
  // метры: «1*10м», «0,57*10м», «10 м.» — цифра + «м» не перед кириллической буквой
  if (/\d\s*м(?![а-яёa-z])/i.test(t) || /ярд/i.test(t)) badIds.push(r.id);
}
console.error(`metre/yard products: ${badIds.length}`);

let cleaned = 0;
for (let i = 0; i < badIds.length; i += 200) {
  const chunk = badIds.slice(i, i + 200);
  const del = await db
    .delete(productAttributes)
    .where(
      and(
        inArray(productAttributes.productId, chunk),
        eq(productAttributes.key, "dimensions"),
        eq(productAttributes.source, "inferred"),
      ),
    );
  cleaned += (del[0] as unknown as { affectedRows?: number }).affectedRows ?? 0;
}
console.log(JSON.stringify({ metreYardProducts: badIds.length, wrongDimsCleaned: cleaned }));
process.exit(0);
