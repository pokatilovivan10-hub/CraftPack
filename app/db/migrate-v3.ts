/**
 * Миграция v3: source_priority у product_images (защита качественных
 * оригиналов от затирания миниатюрами XLSX при повторном импорте).
 * Идемпотентно: проверяет information_schema перед ALTER.
 */
import { getDb } from "../api/queries/connection";
import { sql } from "drizzle-orm";

const db = getDb();

const cols = await db.execute(sql`
  SELECT COLUMN_NAME FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'product_images' AND COLUMN_NAME = 'source_priority'
`);
const rows = (cols as unknown as [unknown[]])[0] ?? [];
if (rows.length === 0) {
  await db.execute(sql`ALTER TABLE product_images ADD COLUMN source_priority INT NOT NULL DEFAULT 10`);
  console.log("product_images.source_priority добавлена (default 10 = миниатюра XLSX)");
} else {
  console.log("product_images.source_priority уже существует");
}

process.exit(0);
