import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { serveStatic } from "@hono/node-server/serve-static";
import type { HttpBindings } from "@hono/node-server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "./router";
import { createContext } from "./context";
import { env } from "./lib/env";

const app = new Hono<{ Bindings: HttpBindings }>();

app.use(bodyLimit({ maxSize: 50 * 1024 * 1024 }));
app.use("/api/trpc/*", async (c) => {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req: c.req.raw,
    router: appRouter,
    createContext,
  });
});

// Фото товаров живут в ./public/uploads и отдаются из-под /api/, чтобы запросы
// гарантированно доходили до сервера, а не перехватывались статическим слоем
// платформы (dist/public в снапшот версии не входит). Имена файлов — sha256
// содержимого, поэтому кэш immutable.
app.use("/api/uploads/*", async (c, next) => {
  await next();
  if (c.res.ok) c.res.headers.set("Cache-Control", "public, max-age=31536000, immutable");
});
app.use(
  "/api/uploads/*",
  serveStatic({ root: "./public", rewriteRequestPath: (p) => p.slice("/api".length) }),
);

app.all("/api/*", (c) => c.json({ error: "Not Found" }, 404));

export default app;

if (env.isProduction) {
  const { serve } = await import("@hono/node-server");
  const { serveStaticFiles } = await import("./lib/vite");
  // Старый путь /uploads/* оставлен для совместимости с уже выданными ссылками
  app.use("/uploads/*", serveStatic({ root: "./public" }));
  serveStaticFiles(app);

  const port = parseInt(process.env.PORT || "3000");
  serve({ fetch: app.fetch, port }, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}
