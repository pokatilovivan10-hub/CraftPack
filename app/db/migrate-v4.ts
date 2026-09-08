/**
 * Миграция v4: variants у product_images — дополнительные размеры изображения
 * (например 480w для srcset в карточках и на мобильных).
 * Идемпотентно: проверяет information_schema перед ALTER.
 */
import { getDb } from "../api/queries/connection";
import { sql } from "drizzle-orm";

const db = getDb();

const cols = await db.execute(sql`
  SELECT COLUMN_NAME FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'product_images' AND COLUMN_NAME = 'variants'
`);
const rows = (cols as unknown as [unknown[]])[0] ?? [];
if (rows.length === 0) {
  await db.execute(sql`ALTER TABLE product_images ADD COLUMN variants JSON NULL`);
  console.log("product_images.variants добавлена");
} else {
  console.log("product_images.variants уже существует");
}

process.exit(0);
