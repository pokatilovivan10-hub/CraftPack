import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { Search, ArrowUpRight } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { Seo } from "@/lib/Seo";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { productsCount } from "@/lib/format";

export default function Catalog() {
  const { data: categories, isLoading } = trpc.catalog.categories.useQuery(undefined, {
    staleTime: 5 * 60_000,
  });
  const [q, setQ] = useState("");
  const navigate = useNavigate();

  return (
    <div className="kp-container py-8">
      <Seo
        title="Каталог упаковки"
        description="Подарочные коробки, пакеты, ленты, бумага и флористика оптом — каталог KRAFTPAK."
        canonicalPath="/catalog"
      />
      <Breadcrumbs items={[{ label: "Каталог" }]} />
      <h1 className="kp-h1 mt-6">Каталог</h1>
      <p className="mt-4 max-w-2xl text-neutral-600">
        Упаковка оптом: от подарочных коробок до расходных материалов для флористов.
      </p>

      <form
        role="search"
        className="mt-8 flex max-w-xl"
        onSubmit={(e) => {
          e.preventDefault();
          if (q.trim()) navigate(`/search?q=${encodeURIComponent(q.trim())}`);
        }}
      >
        <label htmlFor="catalog-search" className="sr-only">
          Поиск по каталогу
        </label>
        <input
          id="catalog-search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Название, артикул, цвет…"
          className="h-12 flex-1 border border-line px-4 text-sm focus:border-ink"
        />
        <button type="submit" className="kp-btn-dark !min-h-12" aria-label="Найти в каталоге">
          <Search className="h-4 w-4" aria-hidden />
          <span className="hidden sm:inline">Найти</span>
        </button>
      </form>

      {isLoading ? (
        <div className="mt-12 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-44 animate-pulse bg-fog" aria-hidden />
          ))}
        </div>
      ) : (
        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {categories?.map((c) => (
            <article key={c.id} className="group border border-line transition-colors duration-300 hover:border-ink">
              <Link to={`/catalog/${c.slug}`} className="flex items-start justify-between p-6">
                <div>
                  <h2 className="text-xl font-bold leading-tight group-hover:underline">{c.name}</h2>
                  <p className="mt-1 text-sm text-neutral-500">
                    {c.productCount > 0 ? productsCount(c.productCount) : "Раздел наполняется"}
                  </p>
                </div>
                <ArrowUpRight
                  className="h-5 w-5 shrink-0 text-neutral-400 transition-all duration-300 group-hover:rotate-45 group-hover:text-ink"
                  aria-hidden
                />
              </Link>
              {c.children.length > 0 && (
                <ul className="flex flex-wrap gap-2 px-6 pb-6">
                  {c.children.slice(0, 5).map((ch) => (
                    <li key={ch.id}>
                      <Link
                        to={`/catalog/${ch.slug}`}
                        className="border border-line px-3 py-1 text-xs hover:border-ink hover:bg-ink hover:text-white"
                      >
                        {ch.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          ))}
        </div>
      )}

      {/* Блок брендирования */}
      <section className="mt-16 grid gap-8 bg-ink p-8 text-white md:grid-cols-[1fr_auto] md:items-center md:p-12">
        <div>
          <h2 className="kp-h2">Продукция с вашим логотипом</h2>
          <p className="mt-3 max-w-xl text-white/70">
            Индивидуальное производство и нанесение логотипа на упаковку.
          </p>
        </div>
        <Link to="/custom-logo" className="kp-btn-primary shrink-0">
          Заказать расчёт
        </Link>
      </section>
    </div>
  );
}
