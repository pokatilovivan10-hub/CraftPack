import { Link } from "react-router";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { Seo } from "@/lib/Seo";
import { site } from "@/config/site";
import { productsCount, imageUrl } from "@/lib/format";
import { ProductCard, ProductCardSkeleton } from "@/components/ProductCard";
import { ConsultationForm } from "@/components/ConsultationForm";

/** Реальные товарные фото из прайса для hero-композиции (оригиналы 750–970 px). */
const HERO_SKUS = {
  main: "721621/1", // квадратный набор
  tiles: ["720745/7", "7201000/487", "721164/1", "721302/5"],
};

/** Представители подразделов «Коробки» для мозаики каталога. */
const MOSAIC_SKUS = {
  nabory: "7211201/417", // набор «Сердце»
  odinochnye: "0007447", // одиночная квадратная
} as const;

/** Составная обложка раздела «Все коробки»: набор + одиночная + ещё две формы. */
const KOROBKI_COVER_SKUS = ["7211201/417", "0007447", "720745/7", "721302/5"] as const;

export default function Home() {
  const { data: categories } = trpc.catalog.categories.useQuery(undefined, { staleTime: 5 * 60_000 });
  const { data: catalogSummary } = trpc.catalog.productsList.useQuery(
    { page: 1, pageSize: 24, sort: "default" },
    { staleTime: 5 * 60_000 },
  );
  const { data: featured, isLoading } = trpc.catalog.featured.useQuery({ limit: 8 });
  const { data: heroProducts } = trpc.catalog.bySkus.useQuery(
    {
      skus: [
        HERO_SKUS.main,
        ...HERO_SKUS.tiles,
        ...Object.values(MOSAIC_SKUS),
        ...KOROBKI_COVER_SKUS,
        "623850/9",
      ],
    },
    { staleTime: 10 * 60_000 },
  );
  const imgBySku = new Map(
    (heroProducts ?? []).map((p) => [p.sku, imageUrl(p.image?.storageKey)]),
  );

  const korobki = (categories ?? []).find((c) => c.slug === "korobki");
  const otherFilled = (categories ?? []).filter((c) => c.productCount > 0 && c.slug !== "korobki");
  const emptyCats = (categories ?? []).filter((c) => c.productCount === 0);

  return (
    <>
      <Seo
        title={site.tagline}
        description="Оптовые поставки подарочной упаковки: коробки, пакеты, ленты, бумага, флористика. Индивидуальное производство с логотипом."
        canonicalPath="/"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "Organization",
          name: site.name,
          telephone: site.phone,
          email: site.email,
          address: site.address,
        }}
      />

      {/* Первый экран: текст + предметная композиция из реальных фото */}
      <section className="bg-ink text-white">
        <div className="kp-container grid items-center gap-10 py-12 lg:grid-cols-[1.1fr_1fr] lg:py-16">
          <div className="kp-fade-in">
            <p className="mb-4 inline-block bg-brand px-3 py-1 text-xs font-bold uppercase tracking-widest text-ink">
              Оптовый каталог упаковки
            </p>
            <h1 className="kp-h1">Подарочная упаковка для вашего бизнеса</h1>
            <p className="mt-6 max-w-xl text-lg text-white/75">
              Коробки, пакеты, ленты и бумага оптом. Собственное производство,
              брендирование логотипом, актуальные остатки в прайсе.
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <Link to="/catalog" className="kp-btn-primary">
                Перейти в каталог
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <a
                href="#consult"
                className="kp-btn-outline !border-white !text-white hover:!border-brand hover:!bg-brand hover:!text-ink"
              >
                Заказать расчёт
              </a>
            </div>
          </div>

          {/* Композиция из реальных товарных фото KRAFTPAK */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" aria-label="Примеры упаковки из каталога">
            {(() => {
              const p = (heroProducts ?? []).find((x) => x.sku === HERO_SKUS.main);
              const src = imgBySku.get(HERO_SKUS.main);
              if (!p || !src) return null;
              return (
                <Link
                  to={`/product/${p.slug}`}
                  className="group relative row-span-2 block bg-white transition-transform duration-300 hover:-translate-y-1"
                >
                  <img
                    src={src}
                    alt="Квадратные подарочные коробки, набор — пример из каталога KRAFTPAK"
                    width={480}
                    height={480}
                    className="h-full w-full object-contain p-4"
                  />
                  <span className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-ink/85 px-3 py-2 text-xs font-semibold uppercase tracking-widest text-white">
                    Наборы
                    <ArrowUpRight className="h-3.5 w-3.5 text-brand" aria-hidden />
                  </span>
                </Link>
              );
            })()}
            {HERO_SKUS.tiles.map((sku) => {
              const p = (heroProducts ?? []).find((x) => x.sku === sku);
              const src = imgBySku.get(sku);
              if (!src || !p) return null;
              return (
                <Link
                  key={sku}
                  to={`/product/${p.slug}`}
                  className="group relative block aspect-square bg-white transition-transform duration-300 hover:-translate-y-1"
                >
                  <img
                    src={src}
                    alt={`${p.title} — фото из каталога KRAFTPAK`}
                    width={240}
                    height={240}
                    loading="lazy"
                    className="h-full w-full object-contain p-2"
                  />
                </Link>
              );
            })}
            <Link
              to="/catalog"
              className="group flex aspect-square flex-col justify-between bg-graphite p-4 transition-colors duration-300 hover:bg-brand hover:text-ink"
            >
              <ArrowUpRight className="h-5 w-5 self-end opacity-60 transition-transform duration-300 group-hover:rotate-45" aria-hidden />
              <span>
                <span className="block text-2xl font-extrabold">{catalogSummary ? catalogSummary.total.toLocaleString("ru-RU") : "—"}</span>
                <span className="mt-1 block text-xs font-semibold uppercase tracking-widest opacity-70">
                  товаров в каталоге
                </span>
              </span>
            </Link>
          </div>
        </div>
      </section>

      {/* Каталог: предметная мозаика наполненных разделов */}
      <section className="kp-container py-16 lg:py-24" aria-labelledby="home-cats">
        <div className="mb-10 flex items-end justify-between gap-6">
          <h2 id="home-cats" className="kp-h2">
            Каталог
          </h2>
          <Link to="/catalog" className="hidden items-center gap-2 text-sm font-semibold uppercase tracking-wide hover:underline sm:flex">
            Все разделы <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>

        {korobki && (
          <div className="grid gap-px bg-line md:grid-cols-2">
            {/* Родительский раздел: счётчик уже включает дочерние — не суммируем повторно */}
            <Link
              to="/catalog/korobki"
              className="group relative flex min-h-[280px] flex-col justify-between overflow-hidden bg-white p-6 transition-colors duration-300 hover:bg-ink hover:text-white md:row-span-2 md:p-8"
            >
              <span className="text-xs font-semibold uppercase tracking-widest text-neutral-400 transition-colors group-hover:text-brand">
                Раздел
              </span>
              <div className="my-6 grid grid-cols-2 gap-2">
                {KOROBKI_COVER_SKUS.map((sku) => {
                  const src = imgBySku.get(sku);
                  const rep = (heroProducts ?? []).find((x) => x.sku === sku);
                  if (!src) return null;
                  return (
                    <span
                      key={sku}
                      className="flex aspect-square items-center justify-center bg-fog transition-colors group-hover:bg-white/10"
                    >
                      <img
                        src={src}
                        alt={rep ? `${rep.title} — пример из раздела «Коробки»` : "Пример упаковки из раздела «Коробки»"}
                        width={240}
                        height={240}
                        loading="lazy"
                        className="h-full w-full object-contain p-2 transition-transform duration-300 group-hover:scale-105"
                      />
                    </span>
                  );
                })}
              </div>
              <div>
                <p className="text-3xl font-extrabold leading-tight">Все коробки</p>
                <p className="mt-2 text-sm text-neutral-500 transition-colors group-hover:text-white/60">
                  {productsCount(korobki.productCount)} — наборы и одиночные, все формы и цвета
                </p>
              </div>
            </Link>
            {korobki.children.map((ch) => {
              const sku = MOSAIC_SKUS[ch.slug as keyof typeof MOSAIC_SKUS];
              const src = sku ? imgBySku.get(sku) : null;
              const rep = sku ? (heroProducts ?? []).find((x) => x.sku === sku) : null;
              return (
                <Link
                  key={ch.id}
                  to={`/catalog/${ch.slug}`}
                  className="group flex items-stretch gap-4 bg-white p-5 transition-colors duration-300 hover:bg-ink hover:text-white"
                >
                  <span className="flex w-24 shrink-0 items-center justify-center bg-fog transition-colors group-hover:bg-white/10">
                    {src ? (
                      <img
                        src={src}
                        alt={rep ? `${rep.title} — пример из раздела «${ch.name}»` : ch.name}
                        width={160}
                        height={160}
                        loading="lazy"
                        className="h-full w-full object-contain p-1.5 transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : null}
                  </span>
                  <span className="flex flex-1 flex-col justify-between py-1">
                    <ArrowUpRight className="h-4 w-4 self-end opacity-40 transition-all duration-300 group-hover:rotate-45 group-hover:text-brand group-hover:opacity-100" aria-hidden />
                    <span>
                      <span className="block text-lg font-bold leading-tight">{ch.name}</span>
                      <span className="mt-1 block text-sm text-neutral-500 transition-colors group-hover:text-white/60">
                        {productsCount(ch.productCount)}
                      </span>
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        )}

        {otherFilled.map((c) => (
          <div key={c.id} className="mt-px grid gap-px bg-line">
            <Link to={`/catalog/${c.slug}`} className="group flex items-center justify-between bg-white p-5 hover:bg-ink hover:text-white">
              <span className="text-lg font-bold">{c.name}</span>
              <span className="text-sm text-neutral-500 group-hover:text-white/60">{productsCount(c.productCount)}</span>
            </Link>
          </div>
        ))}

        {emptyCats.length > 0 && (
          <div className="mt-6 border border-line p-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-neutral-400">
              Разделы в наполнении
            </p>
            <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm text-neutral-600">
              {emptyCats.slice(0, 8).map((c) => (
                <li key={c.id}>{c.name}</li>
              ))}
              {emptyCats.length > 8 && <li>и ещё {emptyCats.length - 8}</li>}
            </ul>
            <p className="mt-3 text-sm text-neutral-500">
              Ассортимент скоро появится. Нужна позиция из этих разделов уже сейчас?{" "}
              <a href="#consult" className="font-semibold text-ink underline">
                Оставьте запрос на подбор
              </a>
              .
            </p>
          </div>
        )}
      </section>

      {/* В наличии: управляемый порядок витрины (round-robin по разделам прайса) */}
      <section className="bg-fog py-16 lg:py-24" aria-labelledby="home-featured">
        <div className="kp-container">
          <div className="mb-10 flex items-end justify-between">
            <div>
              <h2 id="home-featured" className="kp-h2">
                В наличии
              </h2>
              <p className="mt-2 text-sm text-neutral-500">
                Подборка из разных разделов прайса — обновляется после каждого импорта.
              </p>
            </div>
            <Link to="/catalog/korobki" className="hidden items-center gap-2 text-sm font-semibold uppercase tracking-wide hover:underline sm:flex">
              Смотреть всё <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
            {isLoading
              ? Array.from({ length: 8 }).map((_, i) => <ProductCardSkeleton key={i} />)
              : featured?.map((p) => <ProductCard key={p.sku} product={{ ...p, categoryName: null }} />)}
          </div>
        </div>
      </section>

      {/* Брендирование: предметная графитовая сцена */}
      <section className="bg-ink py-16 text-white lg:py-24" aria-labelledby="home-custom">
        <div className="kp-container grid items-center gap-10 lg:grid-cols-2">
          <div>
            <p className="mb-4 inline-block bg-brand px-3 py-1 text-xs font-bold uppercase tracking-widest text-ink">
              Брендирование
            </p>
            <h2 id="home-custom" className="kp-h2">
              Продукция с вашим логотипом
            </h2>
            <p className="mt-5 max-w-lg text-white/75">
              Нанесём логотип на коробки, пакеты и ленты. Рассчитаем тираж,
              подберём материал и способ нанесения под вашу задачу.
            </p>
            <Link to="/custom-logo" className="kp-btn-primary mt-8">
              Подробнее и расчёт
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
          <div>
            <div className="grid grid-cols-2 gap-2">
              {(["721164/1", "623850/9"] as const).map((sku) => {
                const p = (heroProducts ?? []).find((x) => x.sku === sku);
                const src = imgBySku.get(sku);
                if (!src) return null;
                return (
                  <span key={sku} className="flex min-h-44 items-center justify-center bg-white p-4">
                    <img
                      src={src}
                      alt={p ? `${p.title} — упаковка из ассортимента KRAFTPAK` : "Упаковка из ассортимента KRAFTPAK"}
                      width={320}
                      height={320}
                      loading="lazy"
                      className="max-h-40 max-w-40 object-contain"
                    />
                  </span>
                );
              })}
              <div className="col-span-2 grid grid-cols-3 gap-px bg-white/15">
                {["Макет и требования", "Производство", "Доставка тиража"].map((s, i) => (
                  <div key={s} className="bg-graphite p-4">
                    <p className="text-2xl font-extrabold text-brand">{i + 1}</p>
                    <p className="mt-1 text-xs font-semibold uppercase tracking-wide">{s}</p>
                  </div>
                ))}
              </div>
            </div>
            <p className="mt-3 text-xs text-white/45">
              Фото — упаковка из текущего ассортимента; примеры нанесения логотипа являются концепциями, а не кейсами клиентов.
            </p>
          </div>
        </div>
      </section>

      {/* Преимущества — только подтверждённые факты */}
      <section className="kp-container py-16 lg:py-24" aria-labelledby="home-adv">
        <h2 id="home-adv" className="kp-h2 mb-10">
          Почему KRAFTPAK
        </h2>
        <div className="grid gap-px bg-line sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Актуальный прайс", "Цены и остатки обновляются из прайс-листа компании."],
            ["Бренды в ассортименте", site.brands.join(", ") + "."],
            ["Продажа на маркетплейсах", "Представлены на " + site.marketplaces.join(" и ") + "."],
            ["Работаем с юрлицами", "Счета для ИП и ООО, документы к заказу."],
          ].map(([t, d]) => (
            <div key={t} className="bg-white p-7">
              <div className="mb-4 h-1.5 w-10 bg-brand" aria-hidden />
              <p className="text-lg font-bold">{t}</p>
              <p className="mt-2 text-sm text-neutral-600">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Форма консультации */}
      <section id="consult" className="kp-container pb-4" aria-labelledby="home-consult">
        <div className="grid gap-10 border border-line p-6 md:p-12 lg:grid-cols-2">
          <div>
            <h2 id="home-consult" className="kp-h2">
              Нужна помощь с подбором?
            </h2>
            <p className="mt-4 max-w-md text-neutral-600">
              Оставьте контакты — менеджер поможет подобрать упаковку,
              рассчитает тираж и сроки. Работаем {site.workHours.toLowerCase()}.
            </p>
            <p className="mt-6">
              <a href={site.phoneHref} className="text-2xl font-extrabold hover:underline">
                {site.phone}
              </a>
            </p>
          </div>
          <ConsultationForm title="" context="home" />
        </div>
      </section>
    </>
  );
}
