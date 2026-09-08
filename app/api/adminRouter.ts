import { z } from "zod";
import crypto from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { importBatches, importIssues, sectionMappings, categories } from "@db/schema";
import { parsePriceList } from "./import/parsePriceList";
import { applyImport } from "./import/applyImport";

function checkToken(token: string) {
  const expected = process.env.ADMIN_TOKEN || "kraftpak-admin";
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Неверный токен администратора." });
  }
}

// Простейший rate limit для админских мутаций
const lastCall = new Map<string, number>();
function rateLimit(key: string, minMs = 1000) {
  const now = Date.now();
  if (now - (lastCall.get(key) ?? 0) < minMs) {
    throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Слишком частые запросы, подождите." });
  }
  lastCall.set(key, now);
}

const MAX_FILE_SIZE = 30 * 1024 * 1024; // 30 МБ в base64-эквиваленте учитываем после декодирования

export const adminRouter = createRouter({
  login: publicQuery
    .input(z.object({ token: z.string().min(1).max(256) }))
    .mutation(({ input }) => {
      rateLimit("login", 2000);
      checkToken(input.token);
      return { ok: true };
    }),

  /** Импорт XLSX/CSV: dry-run или применение. Файл передаётся base64. */
  importCatalog: publicQuery
    .input(
      z.object({
        token: z.string().min(1).max(256),
        fileName: z.string().min(1).max(512),
        fileBase64: z.string().max(50 * 1024 * 1024),
        mode: z.enum(["dry_run", "apply"]),
      }),
    )
    .mutation(async ({ input }) => {
      checkToken(input.token);
      rateLimit("import", 3000);
      const buffer = Buffer.from(input.fileBase64, "base64");
      if (buffer.length > MAX_FILE_SIZE) {
        throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "Файл больше 30 МБ." });
      }
      // Сигнатура XLSX (ZIP-контейнер)
      const isZip = buffer.length > 4 && buffer[0] === 0x50 && buffer[1] === 0x4b;
      if (!isZip && !/\.csv$/i.test(input.fileName)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Неподдерживаемый формат: ожидается XLSX (ZIP) или CSV.",
        });
      }
      const parsed = await parsePriceList(buffer);
      const summary = await applyImport(parsed, {
        mode: input.mode,
        fileName: input.fileName,
        operator: "admin",
      });
      return { ...summary, issues: summary.issues.slice(0, 200) };
    }),

  batches: publicQuery
    .input(z.object({ token: z.string().min(1).max(256) }))
    .query(async ({ input }) => {
      checkToken(input.token);
      const db = getDb();
      const batches = await db
        .select()
        .from(importBatches)
        .orderBy(desc(importBatches.createdAt))
        .limit(50);
      const issues = batches.length
        ? await db
            .select()
            .from(importIssues)
            .where(eq(importIssues.batchId, batches[0].id))
            .limit(200)
        : [];
      return { batches, latestIssues: issues };
    }),

  mappings: publicQuery
    .input(z.object({ token: z.string().min(1).max(256) }))
    .query(async ({ input }) => {
      checkToken(input.token);
      const db = getDb();
      const maps = await db.select().from(sectionMappings);
      const cats = await db.select().from(categories);
      return { mappings: maps, categories: cats };
    }),

  updateMapping: publicQuery
    .input(
      z.object({
        token: z.string().min(1).max(256),
        sourceSection: z.string().min(1).max(255),
        categoryId: z.number().int().positive(),
      }),
    )
    .mutation(async ({ input }) => {
      checkToken(input.token);
      const db = getDb();
      const existing = await db
        .select()
        .from(sectionMappings)
        .where(eq(sectionMappings.sourceSection, input.sourceSection));
      if (existing.length) {
        await db
          .update(sectionMappings)
          .set({ categoryId: input.categoryId })
          .where(eq(sectionMappings.sourceSection, input.sourceSection));
      } else {
        await db.insert(sectionMappings).values({
          sourceSection: input.sourceSection,
          categoryId: input.categoryId,
        });
      }
      return { ok: true };
    }),
});
