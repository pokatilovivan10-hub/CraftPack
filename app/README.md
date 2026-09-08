# KRAFTPAK — интернет-каталог упаковки

Многостраничный каталог с корзиной, заявками и импортом прайс-листов XLSX.

## Стек

- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS, react-router v7
- **Backend**: Hono + tRPC 11 (type-safe API)
- **БД**: MySQL + Drizzle ORM
- **Импорт**: собственный парсер XLSX (ячейки + встроенные изображения из drawings)

## Команды

```bash
npm install          # зависимости
npm run dev          # разработка, http://localhost:3000
npm run check        # проверка типов
npm run test         # тесты импортёра (vitest)
npm run build        # production build → dist/
npm start            # production server (порт 3000)

npm run db:push      # синхронизация схемы с БД
npx tsx db/seed.ts   # категории + первый импорт samples/коробки подарочные.xlsx
npx tsx db/generateSitemap.ts  # перегенерация public/sitemap.xml
```

## Переменные окружения

См. `.env.example`. Обязательные: `DATABASE_URL`, `ADMIN_TOKEN`.
Опциональные: `SITE_URL`, `ORDER_NOTIFY_WEBHOOK_URL`.

## Структура

```
api/            backend: tRPC-роутеры, импортёр (api/import/)
  import/       parsePriceList.ts — парсер XLSX с drawings
                applyImport.ts    — транзакционный upsert, dry-run, история
                enrich.ts         — осторожное извлечение характеристик
                money.ts          — decimal-арифметика цен
db/             schema.ts, seed.ts, generateSitemap.ts
src/pages/      страницы (главная, каталог, товар, корзина, …)
src/components/ Header (mega-menu, поиск), ProductCard, формы…
src/store/      корзина и сравнение (localStorage)
src/config/     контакты и меню — единая точка правки
samples/        эталонный файл прайса для тестов
public/uploads/ изображения товаров (дедупликация по sha256)
```

## Импорт каталога

1. `/admin/catalog-import` → токен `ADMIN_TOKEN`.
2. Загрузите XLSX → «Проверить (dry-run)» → изучите отчёт.
3. «Применить импорт» → транзакционный upsert по SKU.
4. Повторная загрузка того же файла распознаётся по checksum и не создаёт дублей.
5. Товары, пропавшие из нового файла, помечаются `notSeenInLatestImport`, но не удаляются.
6. Разделы прайса привязываются к категориям таблицей `section_mappings`.

## Аналитика

События идут через нейтральный адаптер: задайте `window.KP_ANALYTICS_ADAPTER = (event) => {...}`
в подключаемом скрипте. Персональные данные в события не передаются.

## Контентные пробелы

Все незаполненные места помечены в интерфейсе как `[НУЖНО ЗАПОЛНИТЬ]`:
политика конфиденциальности, реквизиты, условия оплаты/доставки,
ссылки на магазины маркетплейсов, минимальные тиражи брендирования, видеоматериалы.
