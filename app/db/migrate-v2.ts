/**
 * Разовая миграция v2:
 * 1) создаёт таблицу requests (если её ещё нет);
 * 2) исправляет products.source_updated_at на дату прайса из файла-источника
 *    (раньше ошибочно записывалось время импорта);
 * 3) очищает контентные страницы от редакторских пометок [НУЖНО ЗАПОЛНИТЬ].
 * Идемпотентно. Запуск: npx tsx db/migrate-v2.ts
 */
import { sql, eq } from "drizzle-orm";
import { getDb } from "../api/queries/connection";
import { products, importBatches, contentPages } from "./schema";
import { parseSourceDate } from "../api/import/sourceDate";

const CREATE_REQUESTS = `
CREATE TABLE IF NOT EXISTS \`requests\` (
	\`id\` serial AUTO_INCREMENT NOT NULL,
	\`number\` varchar(32) NOT NULL,
	\`type\` enum('callback','consultation','branding') NOT NULL,
	\`name\` varchar(255) NOT NULL,
	\`phone\` varchar(64) NOT NULL,
	\`preferred_time\` varchar(128),
	\`comment\` text,
	\`pack_type\` varchar(255),
	\`run_size\` varchar(128),
	\`deadline\` varchar(128),
	\`product_sku\` varchar(64),
	\`product_url\` varchar(512),
	\`page_url\` varchar(512),
	\`consent_at\` timestamp NOT NULL,
	\`notify_status\` enum('pending','sent','failed') NOT NULL DEFAULT 'pending',
	\`created_at\` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT \`requests_id\` PRIMARY KEY(\`id\`),
	CONSTRAINT \`requests_number_unique\` UNIQUE(\`number\`)
)`;

const PAGE_TEXTS: Record<string, string> = {
  "delivery-payment":
    "Способы оплаты, сроки и стоимость доставки зависят от состава заказа и региона. " +
    "Менеджер подтвердит условия при расчёте заказа — оставьте заявку или позвоните нам.",
  "privacy-policy":
    "Текст политики обработки персональных данных согласуется и будет опубликован на этой странице. " +
    "Текущая версия сайта работает в демонстрационном режиме: данные из форм сохраняются в тестовую базу " +
    "и используются только для проверки работы сервиса, менеджеру не пересылаются.",
  requisites:
    "Реквизиты компании будут опубликованы после предоставления их заказчиком. " +
    "Для оформления документов к заказу свяжитесь с менеджером.",
};

async function main() {
  const db = getDb();

  // 1. requests
  await db.execute(sql.raw(CREATE_REQUESTS));
  console.log("requests: ok");

  // 2. source_updated_at ← priceDate последней успешной apply-партии
  const batches = await db.select().from(importBatches).where(eq(importBatches.mode, "apply"));
  const latest = batches
    .filter((b) => b.status !== "failed" && b.priceDate)
    .sort((a, b) => b.id - a.id)[0];
  if (latest?.priceDate) {
    const d = parseSourceDate(latest.priceDate);
    if (d) {
      await db.update(products).set({ sourceUpdatedAt: d });
      console.log(`source_updated_at → ${latest.priceDate} (партия #${latest.id})`);
    }
  } else {
    console.log("priceDate у партий не найден — пропуск");
  }

  // 3. Публичные страницы без редакторских пометок
  for (const [slug, content] of Object.entries(PAGE_TEXTS)) {
    await db.update(contentPages).set({ content }).where(eq(contentPages.slug, slug));
    console.log(`page ${slug}: обновлена`);
  }

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
