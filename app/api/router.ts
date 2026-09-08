import { createRouter, publicQuery } from "./middleware";
import { catalogRouter } from "./catalogRouter";
import { searchRouter } from "./searchRouter";
import { orderRouter } from "./orderRouter";
import { requestRouter } from "./requestRouter";
import { adminRouter } from "./adminRouter";
import { contentRouter } from "./contentRouter";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  catalog: catalogRouter,
  search: searchRouter,
  order: orderRouter,
  request: requestRouter,
  admin: adminRouter,
  content: contentRouter,
});

export type AppRouter = typeof appRouter;
