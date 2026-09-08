import { getDb } from "../api/queries/connection";
import { products, importBatches, categories, productImages } from "./schema";

async function main() {
  const db = getDb();
  const p = await db.select().from(products);
  const b = await db.select().from(importBatches);
  const c = await db.select().from(categories);
  const i = await db.select().from(productImages);
  console.log("products:", p.length, "batches:", b.length, "categories:", c.length, "images:", i.length);
  process.exit(0);
}
main().catch((e) => { console.error(e.message); process.exit(1); });
