/**
 * Генерация sitemap.xml из базы (категории + товары + статические страницы).
 * Запуск: npx tsx db/generateSitemap.ts
 * Перегенерировать после каждого применённого импорта.
 */
import fs from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { getDb } from "../api/queries/connection";
import { categories, products } from "./schema";

const BASE = process.env.SITE_URL ?? "https://kraftpak.shop";

async function main() {
  const db = getDb();
  const cats = await db.select().from(categories).where(eq(categories.active, true));
  const prods = await db
    .select({ slug: products.slug, updatedAt: products.updatedAt })
    .from(products)
    .where(eq(products.active, true));

  const staticPages = [
    "", "catalog", "about", "partners", "contacts", "brands", "faq", "news",
    "articles", "vacancies", "requisites", "delivery-payment", "custom-logo",
  ];

  const urls: string[] = [];
  for (const p of staticPages) urls.push(`<url><loc>${BASE}/${p}</loc></url>`);
  for (const c of cats) urls.push(`<url><loc>${BASE}/catalog/${c.slug}</loc></url>`);
  for (const p of prods) {
    urls.push(
      `<url><loc>${BASE}/product/${p.slug}</loc><lastmod>${p.updatedAt.toISOString().slice(0, 10)}</lastmod></url>`,
    );
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>
`;
  const out = path.resolve(process.cwd(), "public/sitemap.xml");
  fs.writeFileSync(out, xml);
  console.log(`sitemap.xml: ${urls.length} URL → ${out}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
