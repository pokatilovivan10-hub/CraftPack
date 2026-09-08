import {
  mysqlTable,
  mysqlEnum,
  serial,
  varchar,
  text,
  int,
  bigint,
  decimal,
  boolean,
  timestamp,
  json,
  uniqueIndex,
  index,
} from "drizzle-orm/mysql-core";

// ─── Категории ────────────────────────────────────────────────────────────────

export const categories = mysqlTable(
  "categories",
  {
    id: serial("id").primaryKey(),
    parentId: bigint("parent_id", { mode: "number", unsigned: true }),
    name: varchar("name", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 255 }).notNull(),
    description: text("description"),
    imageUrl: varchar("image_url", { length: 512 }),
    sortOrder: int("sort_order").notNull().default(0),
    seoTitle: varchar("seo_title", { length: 255 }),
    seoDescription: text("seo_description"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (t) => [
    uniqueIndex("categories_slug_unique").on(t.slug),
    index("categories_parent_idx").on(t.parentId),
    index("categories_active_sort_idx").on(t.active, t.sortOrder),
  ],
);

// ─── Товары ───────────────────────────────────────────────────────────────────

export const products = mysqlTable(
  "products",
  {
    id: serial("id").primaryKey(),
    // Артикул — строковый идентификатор, никогда не преобразуется в число
    sku: varchar("sku", { length: 64 }).notNull(),
    sourceTitle: text("source_title").notNull(),
    title: text("title").notNull(),
    slug: varchar("slug", { length: 512 }).notNull(),
    description: text("description"),
    categoryId: bigint("category_id", { mode: "number", unsigned: true }),
    price: decimal("price", { precision: 12, scale: 2 }),
    currency: varchar("currency", { length: 3 }).notNull().default("RUB"),
    stockStatus: mysqlEnum("stock_status", ["in_stock", "out_of_stock", "unknown"])
      .notNull()
      .default("unknown"),
    stockQuantity: int("stock_quantity"),
    sourceAvailability: varchar("source_availability", { length: 64 }),
    sourceSection: varchar("source_section", { length: 255 }),
    // Нормализованная поисковая строка: lowercase, ё→е, без лишних пробелов
    searchText: text("search_text"),
    publishedAt: timestamp("published_at"),
    sortOrder: int("sort_order").notNull().default(0),
    active: boolean("active").notNull().default(true),
    notSeenInLatestImport: boolean("not_seen_in_latest_import").notNull().default(false),
    sourceUpdatedAt: timestamp("source_updated_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (t) => [
    uniqueIndex("products_sku_unique").on(t.sku),
    uniqueIndex("products_slug_unique").on(t.slug),
    index("products_category_active_idx").on(t.categoryId, t.active),
    index("products_price_idx").on(t.price),
    index("products_stock_idx").on(t.stockStatus),
    index("products_published_idx").on(t.publishedAt),
    index("products_sort_idx").on(t.sortOrder, t.sku),
    index("products_category_price_idx").on(t.categoryId, t.active, t.price),
  ],
);

// ─── Изображения товаров ──────────────────────────────────────────────────────

export const productImages = mysqlTable(
  "product_images",
  {
    id: serial("id").primaryKey(),
    productId: bigint("product_id", { mode: "number", unsigned: true }).notNull(),
    storageKey: varchar("storage_key", { length: 512 }).notNull(),
    hash: varchar("hash", { length: 64 }).notNull(),
    alt: varchar("alt", { length: 512 }),
    width: int("width"),
    height: int("height"),
    // Приоритет источника: 10 — миниатюра XLSX, 50 — оригинал старого сайта, 90 — ручная загрузка.
    // Повторный импорт XLSX не затирает изображение с более высоким приоритетом.
    sourcePriority: int("source_priority").notNull().default(10),
    // Дополнительные размеры того же изображения: {"480": "uploads/products/<hash>_480.jpg"}
    variants: json("variants"),
    sortOrder: int("sort_order").notNull().default(0),
  },
  (t) => [
    index("product_images_product_idx").on(t.productId, t.sortOrder),
    index("product_images_hash_idx").on(t.hash),
  ],
);

// ─── Характеристики товаров ───────────────────────────────────────────────────

export const productAttributes = mysqlTable(
  "product_attributes",
  {
    id: serial("id").primaryKey(),
    productId: bigint("product_id", { mode: "number", unsigned: true }).notNull(),
    key: varchar("key", { length: 64 }).notNull(),
    value: varchar("value", { length: 512 }).notNull(),
    normalizedValue: varchar("normalized_value", { length: 512 }),
    unit: varchar("unit", { length: 32 }),
    source: mysqlEnum("source", ["source", "manual", "inferred"]).notNull().default("inferred"),
    confidence: int("confidence").notNull().default(0),
  },
  (t) => [
    index("product_attributes_product_idx").on(t.productId),
    index("product_attributes_key_value_idx").on(t.key, t.normalizedValue),
  ],
);

// ─── Сопоставление разделов прайс-листа с публичными категориями ─────────────

export const sectionMappings = mysqlTable(
  "section_mappings",
  {
    id: serial("id").primaryKey(),
    sourceSection: varchar("source_section", { length: 255 }).notNull(),
    categoryId: bigint("category_id", { mode: "number", unsigned: true }).notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (t) => [uniqueIndex("section_mappings_section_unique").on(t.sourceSection)],
);

// ─── Импорт ───────────────────────────────────────────────────────────────────

export const importBatches = mysqlTable(
  "import_batches",
  {
    id: serial("id").primaryKey(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    fileName: varchar("file_name", { length: 512 }).notNull(),
    checksum: varchar("checksum", { length: 64 }).notNull(),
    priceDate: varchar("price_date", { length: 64 }),
    mode: mysqlEnum("mode", ["dry_run", "apply"]).notNull(),
    status: mysqlEnum("status", ["success", "partial", "failed"]).notNull(),
    totalRows: int("total_rows").notNull().default(0),
    created: int("created").notNull().default(0),
    updated: int("updated").notNull().default(0),
    unchanged: int("unchanged").notNull().default(0),
    warnings: int("warnings").notNull().default(0),
    errors: int("errors").notNull().default(0),
    operator: varchar("operator", { length: 255 }),
    report: json("report"),
  },
  (t) => [index("import_batches_checksum_idx").on(t.checksum), index("import_batches_created_idx").on(t.createdAt)],
);

export const importIssues = mysqlTable(
  "import_issues",
  {
    id: serial("id").primaryKey(),
    batchId: bigint("batch_id", { mode: "number", unsigned: true }).notNull(),
    rowNumber: int("row_number"),
    sku: varchar("sku", { length: 64 }),
    severity: mysqlEnum("severity", ["warning", "error"]).notNull(),
    message: text("message").notNull(),
  },
  (t) => [index("import_issues_batch_idx").on(t.batchId)],
);

// ─── Заказы ───────────────────────────────────────────────────────────────────

export const orders = mysqlTable(
  "orders",
  {
    id: serial("id").primaryKey(),
    number: varchar("number", { length: 32 }).notNull(),
    status: mysqlEnum("status", ["new", "confirmed", "cancelled", "done"]).notNull().default("new"),
    customerName: varchar("customer_name", { length: 255 }).notNull(),
    phone: varchar("phone", { length: 64 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    company: varchar("company", { length: 255 }),
    inn: varchar("inn", { length: 32 }),
    address: text("address"),
    deliveryMethod: varchar("delivery_method", { length: 128 }),
    comment: text("comment"),
    consentAt: timestamp("consent_at").notNull(),
    itemsCount: int("items_count").notNull().default(0),
    total: decimal("total", { precision: 12, scale: 2 }).notNull().default("0"),
    notifyStatus: mysqlEnum("notify_status", ["pending", "sent", "failed"]).notNull().default("pending"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("orders_number_unique").on(t.number), index("orders_created_idx").on(t.createdAt)],
);

export const orderItems = mysqlTable(
  "order_items",
  {
    id: serial("id").primaryKey(),
    orderId: bigint("order_id", { mode: "number", unsigned: true }).notNull(),
    productId: bigint("product_id", { mode: "number", unsigned: true }),
    snapshotSku: varchar("snapshot_sku", { length: 64 }).notNull(),
    snapshotTitle: text("snapshot_title").notNull(),
    snapshotPrice: decimal("snapshot_price", { precision: 12, scale: 2 }),
    quantity: int("quantity").notNull(),
    lineTotal: decimal("line_total", { precision: 12, scale: 2 }),
  },
  (t) => [index("order_items_order_idx").on(t.orderId)],
);

// ─── Заявки (обратный звонок, консультация, брендирование) ──────────────────

export const requests = mysqlTable(
  "requests",
  {
    id: serial("id").primaryKey(),
    number: varchar("number", { length: 32 }).notNull(),
    type: mysqlEnum("type", ["callback", "consultation", "branding"]).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    phone: varchar("phone", { length: 64 }).notNull(),
    preferredTime: varchar("preferred_time", { length: 128 }),
    comment: text("comment"),
    packType: varchar("pack_type", { length: 255 }),
    runSize: varchar("run_size", { length: 128 }),
    deadline: varchar("deadline", { length: 128 }),
    productSku: varchar("product_sku", { length: 64 }),
    productUrl: varchar("product_url", { length: 512 }),
    pageUrl: varchar("page_url", { length: 512 }),
    consentAt: timestamp("consent_at").notNull(),
    notifyStatus: mysqlEnum("notify_status", ["pending", "sent", "failed"]).notNull().default("pending"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("requests_number_unique").on(t.number), index("requests_created_idx").on(t.createdAt)],
);

// ─── Контентные страницы ─────────────────────────────────────────────────────

export const contentPages = mysqlTable(
  "content_pages",
  {
    id: serial("id").primaryKey(),
    slug: varchar("slug", { length: 255 }).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    content: text("content"),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (t) => [uniqueIndex("content_pages_slug_unique").on(t.slug)],
);

// ─── Типы ─────────────────────────────────────────────────────────────────────

export type Category = typeof categories.$inferSelect;
export type Product = typeof products.$inferSelect;
export type ProductImage = typeof productImages.$inferSelect;
export type ProductAttribute = typeof productAttributes.$inferSelect;
export type ImportBatch = typeof importBatches.$inferSelect;
export type ImportIssue = typeof importIssues.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
export type ContentPage = typeof contentPages.$inferSelect;
export type SectionMapping = typeof sectionMappings.$inferSelect;
export type Request = typeof requests.$inferSelect;
