import devServer from "@hono/vite-dev-server"
import path from "path"
const __dirname = import.meta.dirname
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { inspectAttr } from 'kimi-plugin-inspect-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    devServer({ entry: "api/boot.ts", exclude: [/^\/(?!api\/).*$/] }),
    inspectAttr(), react()],
  server: {
    port: 3000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@contracts": path.resolve(__dirname, "./contracts"),
      "@db": path.resolve(__dirname, "./db"),
      "db": path.resolve(__dirname, "./db"),
    },
  },
  envDir: path.resolve(__dirname),
  // public/uploads — рабочее хранилище загрузок проекта (фото товаров).
  // copyPublicDir: false, иначе Vite при каждой сборке копирует тысячи файлов
  // на FUSE-маунт и зависает; uploads уже лежат в dist/public (см. правило ниже).
  publicDir: false,
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    // dist/public нельзя очищать: там лежит uploads с изображениями каталога.
    emptyOutDir: false,
  },
});
