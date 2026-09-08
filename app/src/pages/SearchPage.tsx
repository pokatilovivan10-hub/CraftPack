import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { Search } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { Seo } from "@/lib/Seo";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Pagination } from "@/components/Pagination";
import { ProductCard, ProductCardSkeleton } from "@/components/ProductCard";
import { productsCount } from "@/lib/format";
import { track } from "@/lib/analytics";

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get("q") ?? "";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const [input, setInput] = useState(q);
  const [prevQ, setPrevQ] = useState(q);
  if (q !== prevQ) {
    setPrevQ(q);
    setInput(q);
  }

  const { data, isLoading } = trpc.search.search.useQuery(
    { q, page, pageSize: 24 },
    { enabled: q.length > 0, placeholderData: (prev) => prev },
  );

  useEffect(() => {
    if (data && q) {
      track(data.total === 0 ? { name: "search_no_results", query: q } : { name: "search", query: q, results: data.total });
    }
  }, [data?.total, q]);

  const recent = useMemo<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("kraftpak_recent_searches") ?? "[]");
    } catch {
      return [];
    }
  }, []);

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const v = input.trim();
    setSearchParams(v ? { q: v } : {});
  };

  return (
    <div className="kp-container py-8">
      <Seo title={q ? `Поиск: ${q}` : "Поиск"} noindex canonicalPath="/search" />
      <Breadcrumbs items={[{ label: "Поиск" }]} />
      <h1 className="kp-h1 mt-6">Поиск</h1>

      <form role="search" onSubmit={submit} className="mt-8 flex max-w-2xl">
        <label htmlFor="search-page-input" className="sr-only">
          Поиск по каталогу
        </label>
        <input
          id="search-page-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Название, артикул, категория…"
          className="h-12 min-w-0 flex-1 border border-line px-4 focus:border-ink"
          autoComplete="off"
        />
        <button type="submit" className="kp-btn-dark !min-h-12">
          <Search className="h-4 w-4" aria-hidden />
          Найти
        </button>
      </form>

      {!q && recent.length > 0 && (
        <section className="mt-8" aria-labelledby="recent-h">
          <div className="flex items-center gap-4">
            <h2 id="recent-h" className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
              Недавние запросы
            </h2>
            <button
              type="button"
              className="text-xs underline"
              onClick={() => {
                localStorage.removeItem("kraftpak_recent_searches");
                setInput((v) => v); // перерисовать
                window.dispatchEvent(new Event("storage"));
              }}
            >
              Очистить
            </button>
          </div>
          <ul className="mt-3 flex flex-wrap gap-2">
            {recent.map((r) => (
              <li key={r}>
                <Link
                  to={`/search?q=${encodeURIComponent(r)}`}
                  className="inline-flex min-h-[44px] items-center border border-line px-3 text-sm hover:border-ink hover:bg-ink hover:text-white"
                >
                  {r}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {q && (
        <div className="mt-10">
          {isLoading ? (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <ProductCardSkeleton key={i} />
              ))}
            </div>
          ) : data && data.items.length > 0 ? (
            <>
              <p className="mb-6 text-sm text-neutral-500" aria-live="polite">
                По запросу «{q}» найдено: {productsCount(data.total)}
              </p>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
                {data.items.map((p) => (
                  <ProductCard key={p.sku} product={p} />
                ))}
              </div>
              <Pagination
                page={page}
                pageSize={data.pageSize}
                total={data.total}
                makeHref={(p) => `/search?q=${encodeURIComponent(q)}${p > 1 ? `&page=${p}` : ""}`}
              />
            </>
          ) : (
            <div className="border border-line p-10 text-center" role="status">
              <p className="text-lg font-bold">По запросу «{q}» ничего не найдено</p>
              <p className="mt-2 text-sm text-neutral-600">
                Проверьте написание, попробуйте синоним или поиск по артикулу.
              </p>
              <Link to="/catalog" className="kp-btn-dark mt-6">
                Перейти в каталог
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
