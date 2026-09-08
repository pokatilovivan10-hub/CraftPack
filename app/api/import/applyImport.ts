import fs from "node:fs";
import path from "node:path";
import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "../queries/connection";
import {
  products,
  productImages,
  productAttributes,
  sectionMappings,
  importBatches,
  importIssues,
} from "@db/schema";
import type { ParseResult, ParsedProductRow, ImportIssueData } from "./parsePriceList";
import { inferAttributes } from "./enrich";
import { productSlug, normalizeSearch } from "./slug";
import { parseSourceDate } from "./sourceDate";

export interface ApplyOptions {
  mode: "dry_run" | "apply";
  fileName: string;
  operator?: string;
  /** Каталог для сохранения файлов изображений (относительно корня проекта) */
  uploadsDir?: string;
}

export interface ApplySummary {
  batchId: number;
  duplicateOfBatchId?: number;
  status: "success" | "partial" | "failed";
  totalRows: number;
  created: number;
  updated: number;
  unchanged: number;
  warnings: number;
  errors: number;
  issues: ImportIssueData[];
  priceDate: string | null;
  sections: Record<string, number>;
}

const DEFAULT_UPLOADS_DIR = path.resolve(process.cwd(), "public/uploads/products");
/** Приоритет миниатюры из XLSX; оригиналы старого сайта (50) и ручные (90) не затираются. */
const XLSX_IMAGE_PRIORITY = 10;

/**
 * Применяет результат парсинга к базе (или только проверяет в режиме dry-run).
 * Upsert по нормализованному SKU; товары вне файла не удаляются,
 * а помечаются notSeenInLatestImport внутри затронутых разделов.
 */
export async function applyImport(parsed: ParseResult, opts: ApplyOptions): Promise<ApplySummary> {
  const db = getDb();
  const issues: ImportIssueData[] = [...parsed.issues];

  // Повторная загрузка идентичного файла распознаётся по checksum
  const existing = await db
    .select()
    .from(importBatches)
    .where(eq(importBatches.checksum, parsed.fileChecksum));
  const successfulApply = existing.find((b) => b.mode === "apply" && b.status !== "failed");
  if (opts.mode === "apply" && successfulApply) {
    return {
      batchId: successfulApply.id,
      duplicateOfBatchId: successfulApply.id,
      status: successfulApply.status,
      totalRows: successfulApply.totalRows,
      created: 0,
      updated: 0,
      unchanged: successfulApply.totalRows,
      warnings: 0,
      errors: 0,
      issues: [
        {
          rowNumber: null,
          sku: null,
          severity: "warning",
          message: `Файл идентичен партии #${successfulApply.id} от ранее выполненного импорта — повторное применение пропущено, дубли не созданы.`,
        },
      ],
      priceDate: parsed.priceDate,
      sections: parsed.sections,
    };
  }

  // Карта «исходный раздел → публичная категория» из явной таблицы сопоставления
  const mappings = await db.select().from(sectionMappings);
  const sectionToCategory = new Map(mappings.map((m) => [m.sourceSection, m.categoryId]));

  const skus = parsed.products.map((p) => p.sku);
  const existingProducts = await db.select().from(products).where(inArray(products.sku, skus));
  const existingBySku = new Map(existingProducts.map((p) => [p.sku, p]));

  let created = 0;
  let updated = 0;
  let unchanged = 0;
  const hasErrors = issues.some((i) => i.severity === "error");

  if (opts.mode === "dry_run") {
    for (const row of parsed.products) {
      const ex = existingBySku.get(row.sku);
      if (!ex) created++;
      else if (productChanged(ex, row)) updated++;
      else unchanged++;
      if (!sectionToCategory.has(row.section)) {
        // не дублируем предупреждение на каждый товар
      }
    }
    for (const section of Object.keys(parsed.sections)) {
      if (!sectionToCategory.has(section)) {
        issues.push({
          rowNumber: null,
          sku: null,
          severity: "warning",
          message: `Для раздела «${section}» нет сопоставления с категорией — товары будут без категории до настройки в админке.`,
        });
      }
    }
  }

  if (opts.mode === "apply" && !hasErrors) {
    const uploadsDir = opts.uploadsDir ?? DEFAULT_UPLOADS_DIR;
    fs.mkdirSync(uploadsDir, { recursive: true });
    const now = new Date();
    // Дата актуальности прайса — из файла, а не момент импорта
    const sourceDate = parseSourceDate(parsed.priceDate) ?? now;

    await db.transaction(async (tx) => {
      const seenSkus = new Set<string>();

      for (const row of parsed.products) {
        seenSkus.add(row.sku);
        const categoryId = sectionToCategory.get(row.section) ?? null;
        const ex = existingBySku.get(row.sku);

        // Сохранение файла изображения с дедупликацией по hash
        let storageKey: string | null = null;
        if (row.image) {
          storageKey = `uploads/products/${row.image.hash}.${row.image.ext}`;
          const abs = path.resolve(process.cwd(), "public", storageKey);
          if (!fs.existsSync(abs)) {
            fs.writeFileSync(abs, row.image.bytes);
          }
        }

        if (!ex) {
          created++;
          const slug = productSlug(row.title, row.sku);
          const inserted = await tx.insert(products).values({
            sku: row.sku,
            sourceTitle: row.sourceTitle,
            title: row.title,
            slug,
            categoryId,
            price: row.price,
            stockStatus: row.stockStatus,
            stockQuantity: row.stockQuantity,
            sourceAvailability: row.availabilityRaw || null,
            sourceSection: row.section || null,
            searchText: buildSearchText(row),
            publishedAt: now,
            sortOrder: 0,
            active: true,
            notSeenInLatestImport: false,
            sourceUpdatedAt: sourceDate,
          });
          const productId = Number(inserted[0].insertId);
          if (storageKey && row.image) {
            await tx.insert(productImages).values({
              productId,
              storageKey,
              hash: row.image.hash,
              alt: row.title.slice(0, 300),
              width: row.image.width,
              height: row.image.height,
              sourcePriority: XLSX_IMAGE_PRIORITY,
              sortOrder: 0,
            });
          }
          await replaceInferredAttributes(tx, productId, row);
        } else {
          const changed = productChanged(ex, row);
          if (changed) updated++;
          else unchanged++;
          await tx
            .update(products)
            .set({
              sourceTitle: row.sourceTitle,
              title: row.title,
              categoryId,
              price: row.price,
              stockStatus: row.stockStatus,
              stockQuantity: row.stockQuantity,
              sourceAvailability: row.availabilityRaw || null,
              sourceSection: row.section || null,
              searchText: buildSearchText(row),
              notSeenInLatestImport: false,
              sourceUpdatedAt: sourceDate,
            })
            .where(eq(products.id, ex.id));
          if (storageKey && row.image) {
            const hasImage = await tx
              .select()
              .from(productImages)
              .where(eq(productImages.productId, ex.id));
            // Не затираем качественный оригинал (старого сайта/ручной) миниатюрой XLSX:
            // заменяем только если текущее изображение не приоритетнее входящего
            const best = hasImage.reduce((m, i) => Math.max(m, i.sourcePriority), 0);
            if (best <= XLSX_IMAGE_PRIORITY && (!hasImage.length || hasImage[0].hash !== row.image.hash)) {
              await tx.delete(productImages).where(eq(productImages.productId, ex.id));
              await tx.insert(productImages).values({
                productId: ex.id,
                storageKey,
                hash: row.image.hash,
                alt: row.title.slice(0, 300),
                width: row.image.width,
                height: row.image.height,
                sourcePriority: XLSX_IMAGE_PRIORITY,
                sortOrder: 0,
              });
            }
          }
          await replaceInferredAttributes(tx, ex.id, row);
        }
      }

      // Товары затронутых разделов, которых нет в файле, — помечаем, НЕ удаляем
      const fileSections = Object.keys(parsed.sections);
      if (fileSections.length) {
        const inSections = await tx
          .select()
          .from(products)
          .where(inArray(products.sourceSection, fileSections));
        for (const p of inSections) {
          if (!seenSkus.has(p.sku) && !p.notSeenInLatestImport) {
            await tx
              .update(products)
              .set({ notSeenInLatestImport: true })
              .where(eq(products.id, p.id));
          }
        }
      }
    });
  }

  const warnings = issues.filter((i) => i.severity === "warning").length;
  const errors = issues.filter((i) => i.severity === "error").length;
  const status = errors > 0 ? "failed" : warnings > 0 ? "partial" : "success";

  const batchInsert = await db.insert(importBatches).values({
    fileName: opts.fileName,
    checksum: parsed.fileChecksum,
    priceDate: parsed.priceDate,
    mode: opts.mode,
    status,
    totalRows: parsed.products.length,
    created,
    updated,
    unchanged,
    warnings,
    errors,
    operator: opts.operator ?? null,
    report: { sections: parsed.sections, priceDate: parsed.priceDate },
  });
  const batchId = Number(batchInsert[0].insertId);

  if (issues.length) {
    await db.insert(importIssues).values(
      issues.slice(0, 5000).map((i) => ({
        batchId,
        rowNumber: i.rowNumber,
        sku: i.sku,
        severity: i.severity,
        message: i.message,
      })),
    );
  }

  return {
    batchId,
    status,
    totalRows: parsed.products.length,
    created,
    updated,
    unchanged,
    warnings,
    errors,
    issues,
    priceDate: parsed.priceDate,
    sections: parsed.sections,
  };
}

function productChanged(ex: typeof products.$inferSelect, row: ParsedProductRow): boolean {
  return (
    ex.title !== row.title ||
    ex.sourceTitle !== row.sourceTitle ||
    ex.price !== row.price ||
    ex.stockStatus !== row.stockStatus ||
    (ex.stockQuantity ?? null) !== row.stockQuantity ||
    (ex.sourceSection ?? "") !== (row.section ?? "")
  );
}

function buildSearchText(row: ParsedProductRow): string {
  return normalizeSearch(`${row.title} ${row.sku} ${row.section}`);
}

/** Перезаписывает только inferred-атрибуты; ручные правки администратора не затирает. */
async function replaceInferredAttributes(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx: any,
  productId: number,
  row: ParsedProductRow,
): Promise<void> {
  await tx
    .delete(productAttributes)
    .where(
      and(
        eq(productAttributes.productId, productId),
        eq(productAttributes.source, "inferred"),
      ),
    );
  const inferred = inferAttributes(row.title);
  if (!inferred.length) return;
  await tx.insert(productAttributes).values(
    inferred.map((a) => ({
      productId,
      key: a.key,
      value: a.value,
      normalizedValue: a.normalizedValue ?? null,
      unit: a.unit ?? null,
      source: "inferred" as const,
      confidence: a.confidence,
    })),
  );
}
