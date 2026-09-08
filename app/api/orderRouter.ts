import { z } from "zod";
import { and, eq, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { orders, orderItems, products } from "@db/schema";
import { moneyMul, moneyAdd, toCents } from "./import/money";
import { notifyManager } from "./notify";

const phoneRe = /^[+()\- 0-9]{10,20}$/;

const orderInput = z.object({
  customerName: z.string().trim().min(2, "Укажите имя").max(255),
  phone: z.string().trim().regex(phoneRe, "Укажите корректный телефон"),
  email: z.string().trim().email("Укажите корректный email").max(255),
  company: z.string().trim().max(255).optional(),
  inn: z.string().trim().max(32).optional(),
  address: z.string().trim().max(2000).optional(),
  deliveryMethod: z.string().trim().max(128).optional(),
  comment: z.string().trim().max(2000).optional(),
  consent: z.literal(true, { message: "Требуется согласие на обработку данных" }),
  honeypot: z.string().max(0).optional(),
  items: z
    .array(
      z.object({
        sku: z.string().min(1).max(64),
        quantity: z.number().int().min(1).max(100000),
      }),
    )
    .min(1, "Корзина пуста")
    .max(500),
});

export const orderRouter = createRouter({
  create: publicQuery.input(orderInput).mutation(async ({ input }) => {
    if (input.honeypot) {
      // Спам-ловушка: молча «принимаем», не создавая заказ
      return { number: "OK", total: "0.00", itemsCount: 0 };
    }
    const db = getDb();

    // Объединение одинаковых SKU
    const qtyBySku = new Map<string, number>();
    for (const it of input.items) {
      qtyBySku.set(it.sku, (qtyBySku.get(it.sku) ?? 0) + it.quantity);
    }
    const skus = [...qtyBySku.keys()];
    const dbProducts = await db
      .select()
      .from(products)
      .where(and(inArray(products.sku, skus), eq(products.active, true)));
    const bySku = new Map(dbProducts.map((p) => [p.sku, p]));

    const missing = skus.filter((s) => !bySku.has(s));
    if (missing.length) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Товары с артикулами ${missing.join(", ")} сняты с публикации. Обновите корзину.`,
      });
    }

    // Серверная проверка цен и наличия
    const lines: Array<{
      product: (typeof dbProducts)[number];
      quantity: number;
      lineTotal: string | null;
    }> = [];
    let total = "0.00";
    let hasNoPrice = false;
    for (const sku of skus) {
      const p = bySku.get(sku)!;
      const quantity = qtyBySku.get(sku)!;
      if (p.stockStatus === "out_of_stock") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Товар «${p.title}» (${p.sku}) отсутствует в наличии.`,
        });
      }
      if (p.price === null) {
        hasNoPrice = true;
        lines.push({ product: p, quantity, lineTotal: null });
      } else {
        const lineTotal = moneyMul(p.price, quantity);
        total = moneyAdd(total, lineTotal);
        lines.push({ product: p, quantity, lineTotal });
      }
    }

    const number = await nextOrderNumber();
    const inserted = await db.insert(orders).values({
      number,
      customerName: input.customerName,
      phone: input.phone,
      email: input.email,
      company: input.company || null,
      inn: input.inn || null,
      address: input.address || null,
      deliveryMethod: input.deliveryMethod || null,
      comment: input.comment || null,
      consentAt: new Date(),
      itemsCount: lines.reduce((s, l) => s + l.quantity, 0),
      total,
    });
    const orderId = Number(inserted[0].insertId);
    await db.insert(orderItems).values(
      lines.map((l) => ({
        orderId,
        productId: l.product.id,
        snapshotSku: l.product.sku,
        snapshotTitle: l.product.title,
        snapshotPrice: l.product.price,
        quantity: l.quantity,
        lineTotal: l.lineTotal,
      })),
    );

    // Ошибка уведомления не теряет заказ — статус фиксируется для retry
    const notify = await notifyManager(number);
    if (notify === "failed") {
      await db.update(orders).set({ notifyStatus: "failed" }).where(eq(orders.id, orderId));
    } else {
      await db.update(orders).set({ notifyStatus: "sent" }).where(eq(orders.id, orderId));
    }

    return { number, total, itemsCount: lines.reduce((s, l) => s + l.quantity, 0), hasNoPrice };
  }),

  /** Серверная валидация корзины перед показом итогов. */
  validateCart: publicQuery
    .input(
      z.object({
        items: z.array(z.object({ sku: z.string().max(64), quantity: z.number().int().min(1).max(100000) })).max(500),
      }),
    )
    .query(async ({ input }) => {
      if (!input.items.length) return { lines: [], total: "0.00" };
      const db = getDb();
      const qtyBySku = new Map<string, number>();
      for (const it of input.items) qtyBySku.set(it.sku, (qtyBySku.get(it.sku) ?? 0) + it.quantity);
      const dbProducts = await db
        .select()
        .from(products)
        .where(inArray(products.sku, [...qtyBySku.keys()]));
      const bySku = new Map(dbProducts.map((p) => [p.sku, p]));
      let total = "0.00";
      const lines = [...qtyBySku.entries()].map(([sku, quantity]) => {
        const p = bySku.get(sku);
        if (!p || !p.active) {
          return { sku, quantity, status: "unavailable" as const, title: null, price: null, lineTotal: null, stockStatus: null };
        }
        const lineTotal = p.price !== null ? moneyMul(p.price, quantity) : null;
        if (lineTotal) total = moneyAdd(total, lineTotal);
        return {
          sku,
          quantity,
          status: p.stockStatus === "out_of_stock" ? ("out_of_stock" as const) : ("ok" as const),
          title: p.title,
          price: p.price,
          lineTotal,
          stockStatus: p.stockStatus,
        };
      });
      void toCents;
      return { lines, total };
    }),
});

async function nextOrderNumber(): Promise<string> {
  const db = getDb();
  const year = new Date().getFullYear();
  // Простая уникальная нумерация: KP-<год>-<id sequence по количеству>
  const all = await db.select({ n: orders.id }).from(orders);
  const seq = all.length + 1;
  return `KP-${year}-${String(seq).padStart(5, "0")}`;
}
