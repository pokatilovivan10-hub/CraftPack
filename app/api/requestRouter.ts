import { z } from "zod";
import { eq } from "drizzle-orm";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { requests } from "@db/schema";
import { notifyManager } from "./notify";

const phoneRe = /^[+()\- 0-9]{10,20}$/;

const requestInput = z.object({
  type: z.enum(["callback", "consultation", "branding"]),
  name: z.string().trim().min(2, "Укажите имя").max(255),
  phone: z.string().trim().regex(phoneRe, "Укажите корректный телефон"),
  preferredTime: z.string().trim().max(128).optional(),
  comment: z.string().trim().max(2000).optional(),
  // Поля брендирования
  packType: z.string().trim().max(255).optional(),
  runSize: z.string().trim().max(128).optional(),
  deadline: z.string().trim().max(128).optional(),
  // Контекст товара/страницы
  productSku: z.string().trim().max(64).optional(),
  productUrl: z.string().trim().max(512).optional(),
  pageUrl: z.string().trim().max(512).optional(),
  consent: z.literal(true, { message: "Требуется согласие на обработку данных" }),
  honeypot: z.string().max(512).optional(),
});

export const requestRouter = createRouter({
  /**
   * Создание заявки. Сначала сохраняется в БД, затем уведомляется менеджер;
   * сбой уведомления не теряет заявку (notifyStatus = failed).
   */
  create: publicQuery.input(requestInput).mutation(async ({ input }) => {
    if (input.honeypot) {
      // Спам-ловушка: молча «принимаем», не создавая заявку
      return { number: "OK" };
    }
    const db = getDb();
    const number = await nextRequestNumber();
    const inserted = await db.insert(requests).values({
      number,
      type: input.type,
      name: input.name,
      phone: input.phone,
      preferredTime: input.preferredTime || null,
      comment: input.comment || null,
      packType: input.packType || null,
      runSize: input.runSize || null,
      deadline: input.deadline || null,
      productSku: input.productSku || null,
      productUrl: input.productUrl || null,
      pageUrl: input.pageUrl || null,
      consentAt: new Date(),
    });
    const id = Number(inserted[0].insertId);

    const notify = await notifyManager(`Заявка ${number}`);
    await db
      .update(requests)
      .set({ notifyStatus: notify === "sent" ? "sent" : "failed" })
      .where(eq(requests.id, id));

    return { number };
  }),
});

async function nextRequestNumber(): Promise<string> {
  const db = getDb();
  const year = new Date().getFullYear();
  const all = await db.select({ n: requests.id }).from(requests);
  return `RQ-${year}-${String(all.length + 1).padStart(5, "0")}`;
}
