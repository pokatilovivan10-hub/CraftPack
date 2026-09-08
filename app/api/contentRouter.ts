import { z } from "zod";
import { eq } from "drizzle-orm";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { contentPages } from "@db/schema";

export const contentRouter = createRouter({
  page: publicQuery
    .input(z.object({ slug: z.string().min(1).max(255) }))
    .query(async ({ input }) => {
      const db = getDb();
      const [page] = await db.select().from(contentPages).where(eq(contentPages.slug, input.slug));
      return page ?? null;
    }),
});
