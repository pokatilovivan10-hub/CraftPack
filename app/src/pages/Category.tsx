import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router";
import { X, SlidersHorizontal, ChevronDown, Search } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { Seo } from "@/lib/Seo";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Pagination } from "@/components/Pagination";
import { ProductCard, ProductCardSkeleton } from "@/components/ProductCard";
import { productsCount } from "@/lib/format";
import { track } from "@/lib/analytics";
import NotFound from "./NotFound";

const SORT_LABELS: Record<string, string> = {
  default: "По умолчанию",
  price_asc: "Сначала дешевле",
  price_desc: "Сначала дороже",
  new: "Сначала новые",
};

const COLOR_LIST_COLLAPSED = 6;

/** Число из query-параметра с валидацией. */
function numParam(v: string | null): number | undefined {
  if (v === null) return undefined;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

function colorsFromParam(v: string | null): string[] {
  if (!v) return [];
  return v.split(",").map((s) => s.trim()).filter(Boolean);
}

export interface FilterState {
  inStock: boolean;
  priceMin?: number;
  priceMax?: number;
  colors: string[];
}

export default function Category() {
  const params = useParams();
  const slug = params["*"] ?? "";
  const [searchParams, setSearchParams] = useSearchParams();

  const sort = (searchParams.get("sort") ?? "default") as "default" | "price_asc" | "price_desc" | "new";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const inStock = searchParams.get("in_stock") === "1";
  const priceMin = numParam(searchParams.get("price_min"));
  const priceMax = numParam(searchParams.get("price_max"));
  const colors = colorsFromParam(searchParams.get("colors"));

  const { data: catData, isLoading: catLoading } = trpc.catalog.categoryBySlug.useQuery(
    { slug },
    { enabled: !!slug },
  );

  const listInput = useMemo(
    () => ({
      categorySlug: slug,
      sort,
      page,
      pageSize: 24 as const,
      inStock: inStock || undefined,
      priceMin,
      priceMax,
      colors: colors.length ? colors : undefined,
    }),
    [slug, sort, page, inStock, priceMin, priceMax, colors],
  );

  const { data, isLoading, isFetching } = trpc.catalog.productsList.useQuery(listInput, {
    placeholderData: (prev) => prev,
  });

  useEffect(() => {
    if (slug) track({ name: "view_category", categorySlug: slug });
  }, [slug]);

  /** Обновление URL: смена фильтра сбрасывает page на 1. */
  const setParams = (patch: Record<string, string | undefined>, resetPage = true) => {
    const next = new URLSearchParams(searchParams);
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined || v === "") next.delete(k);
      else next.set(k, v);
    }
    if (resetPage && !("page" in patch)) next.delete("page");
    setSearchParams(next, { preventScrollReset: true });
  };

  const toggleColor = (value: string) => {
    const next = colors.includes(value) ? colors.filter((c) => c !== value) : [...colors, value];
    setParams({ colors: next.length ? next.join(",") : undefined });
    track({ name: "apply_filter", filter: "color", value });
  };

  const makeHref = (p: number) => {
    const next = new URLSearchParams(searchParams);
    if (p <= 1) next.delete("page");
    else next.set("page", String(p));
    const qs = next.toString();
    return `/catalog/${slug}${qs ? `?${qs}` : ""}`;
  };

  const activeCount =
    (inStock ? 1 : 0) + (priceMin !== undefined || priceMax !== undefined ? 1 : 0) + colors.length;

  const resetAll = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("in_stock");
    next.delete("price_min");
    next.delete("price_max");
    next.delete("colors");
    next.delete("page");
    setSearchParams(next, { preventScrollReset: true });
  };

  if (!catLoading && !catData) return <NotFound />;
  const cat = catData?.category;

  const rangeFrom = data && data.total > 0 ? (page - 1) * data.pageSize + 1 : 0;
  const rangeTo = data ? Math.min(page * data.pageSize, data.total) : 0;

  return (
    <div className="kp-container py-8">
      <Seo
        title={cat?.seoTitle ?? cat?.name ?? "Категория"}
        description={cat?.seoDescription ?? cat?.description ?? `${cat?.name ?? ""} — каталог KRAFTPAK`}
        canonicalPath={`/catalog/${slug}`}
        jsonLd={
          catData
            ? {
                "@context": "https://schema.org",
                "@type": "BreadcrumbList",
                itemListElement: [
                  { "@type": "ListItem", position: 1, name: "Главная", item: "/" },
                  ...(catData.breadcrumbs ?? []).map((c, i) => ({
                    "@type": "ListItem",
                    position: i + 2,
                    name: c.name,
                    item: `/catalog/${c.slug}`,
                  })),
                ],
              }
            : undefined
        }
      />

      <Breadcrumbs
        items={[
          { label: "Каталог", to: "/catalog" },
          ...(catData?.breadcrumbs ?? []).map((c) => ({ label: c.name, to: `/catalog/${c.slug}` })),
        ]}
      />

      <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <h1 className="kp-h1">{cat?.name ?? "…"}</h1>
        {data && (
          <p className="text-sm text-neutral-500" aria-live="polite">
            Найдено {productsCount(data.total)}
            {data.total > 0 && <> · показаны {rangeFrom}–{rangeTo}</>}
          </p>
        )}
      </div>
      {cat?.description && <p className="mt-4 max-w-2xl text-neutral-600">{cat.description}</p>}

      {/* Дочерние подкатегории */}
      {catData && catData.children.length > 0 && (
        <ul className="mt-6 flex flex-wrap gap-2">
          {catData.children.map((ch) => (
            <li key={ch.id}>
              <a
                href={`/catalog/${ch.slug}`}
                className="inline-flex min-h-[44px] items-center border border-line px-4 py-2 text-sm hover:border-ink hover:bg-ink hover:text-white"
              >
                {ch.name}
              </a>
            </li>
          ))}
        </ul>
      )}

      {/* Мобильная кнопка фильтров */}
      <div className="mt-6 lg:hidden">
        <MobileFilters
          state={{ inStock, priceMin, priceMax, colors }}
          facets={data?.facets}
          activeCount={activeCount}
          onToggleColor={toggleColor}
          onSetParams={setParams}
          onReset={resetAll}
        />
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[260px_1fr]">
        {/* Фильтры — десктоп */}
        <aside aria-label="Фильтры" className="hidden space-y-6 lg:sticky lg:top-24 lg:block lg:self-start">
          <FiltersPanel
            state={{ inStock, priceMin, priceMax, colors }}
            facets={data?.facets}
            onToggleColor={toggleColor}
            onSetParams={setParams}
          />
          {activeCount > 0 && (
            <button type="button" className="kp-btn-outline w-full" onClick={resetAll}>
              Сбросить фильтры
            </button>
          )}
        </aside>

        {/* Список товаров */}
        <div>
          <div className="mb-5 flex items-center justify-between gap-4">
            <label className="flex items-center gap-2 text-sm">
              <span className="text-neutral-500">Сортировка:</span>
              <select
                value={sort}
                onChange={(e) => setParams({ sort: e.target.value === "default" ? undefined : e.target.value })}
                className="h-11 border border-line bg-white px-3 text-sm focus:border-ink"
              >
                {Object.entries(SORT_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {/* Чипы выбранных фильтров */}
          {activeCount > 0 && (
            <ul className="mb-5 flex flex-wrap gap-2" aria-label="Выбранные фильтры">
              {inStock && (
                <Chip label="В наличии" onRemove={() => setParams({ in_stock: undefined })} />
              )}
              {(priceMin !== undefined || priceMax !== undefined) && (
                <Chip
                  label={`Цена: ${priceMin ?? "…"}–${priceMax ?? "…"} ₽`}
                  onRemove={() => setParams({ price_min: undefined, price_max: undefined })}
                />
              )}
              {colors.map((c) => (
                <Chip key={c} label={`Цвет: ${c}`} onRemove={() => toggleColor(c)} />
              ))}
              <li>
                <button
                  type="button"
                  className="min-h-[44px] px-2 text-xs font-semibold uppercase tracking-wide underline"
                  onClick={resetAll}
                >
                  Сбросить всё
                </button>
              </li>
            </ul>
          )}

          {isLoading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <ProductCardSkeleton key={i} />
              ))}
            </div>
          ) : data && data.items.length > 0 ? (
            <>
              <div
                className={`grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 ${
                  isFetching ? "opacity-60 transition-opacity" : "transition-opacity"
                }`}
              >
                {data.items.map((p) => (
                  <ProductCard key={p.sku} product={{ ...p, categoryName: cat?.name }} />
                ))}
              </div>
              <Pagination page={page} pageSize={data.pageSize} total={data.total} makeHref={makeHref} />
            </>
          ) : activeCount > 0 ? (
            /* Фильтры выбраны и исключили все товары */
            <div className="border border-line p-10 text-center" role="status">
              <p className="text-lg font-bold">Ничего не найдено</p>
              <p className="mt-2 text-sm text-neutral-600">
                Выбранные фильтры исключили все товары раздела. Попробуйте смягчить условия.
              </p>
              <button type="button" className="kp-btn-outline mt-6" onClick={resetAll}>
                Сбросить фильтры
              </button>
            </div>
          ) : (
            /* Раздел ещё не наполнен — фильтры не выбраны, сбрасывать нечего */
            <div className="border border-line p-10 text-center" role="status">
              <p className="text-lg font-bold">Раздел в наполнении</p>
              <p className="mt-2 text-sm text-neutral-600">
                Товары этого раздела скоро появятся в прайсе. Нужна такая позиция уже сейчас?
                Подберём по индивидуальному запросу.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <a href="/#consult" className="kp-btn-primary">
                  Запросить подбор
                </a>
                <a href="/catalog" className="kp-btn-outline">
                  Смотреть наполненные разделы
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <li>
      <span className="inline-flex min-h-[44px] items-center gap-2 border border-line bg-fog px-3 text-sm capitalize">
        {label}
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Убрать фильтр: ${label}`}
          className="flex h-6 w-6 items-center justify-center hover:bg-line"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      </span>
    </li>
  );
}

interface PanelProps {
  state: FilterState;
  facets?: { priceMin: number | null; priceMax: number | null; colors: { value: string; count: number }[] };
  onToggleColor: (v: string) => void;
  onSetParams: (patch: Record<string, string | undefined>, resetPage?: boolean) => void;
  /** drawer-режим: изменения копятся и применяются кнопкой */
  defer?: boolean;
  onApply?: (state: FilterState) => void;
}

/** Панель фильтров: наличие, цена (debounce + применение), цвета (OR-чекбоксы, поиск, раскрытие). */
function FiltersPanel({ state, facets, onToggleColor, onSetParams, defer, onApply }: PanelProps) {
  // Локальный черновик (в drawer-режиме — до кнопки «Показать»)
  const [localInStock, setLocalInStock] = useState(state.inStock);
  const [localColors, setLocalColors] = useState<string[]>(state.colors);
  const [minDraft, setMinDraft] = useState(state.priceMin?.toString() ?? "");
  const [maxDraft, setMaxDraft] = useState(state.priceMax?.toString() ?? "");
  const [priceError, setPriceError] = useState("");
  const [colorQuery, setColorQuery] = useState("");
  const [colorsExpanded, setColorsExpanded] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Синхронизация при внешнем изменении URL (back/forward, чипы)
  const [prevState, setPrevState] = useState(state);
  if (prevState !== state) {
    setPrevState(state);
    setLocalInStock(state.inStock);
    setLocalColors(state.colors);
    setMinDraft(state.priceMin?.toString() ?? "");
    setMaxDraft(state.priceMax?.toString() ?? "");
    setPriceError("");
  }

  useEffect(() => () => clearTimeout(debounceRef.current), []);

  const curInStock = defer ? localInStock : state.inStock;
  const curColors = defer ? localColors : state.colors;

  const applyPrice = (minS: string, maxS: string) => {
    const min = minS === "" ? undefined : Number(minS);
    const max = maxS === "" ? undefined : Number(maxS);
    if ((min !== undefined && !Number.isFinite(min)) || (max !== undefined && !Number.isFinite(max))) return;
    if (min !== undefined && max !== undefined && min > max) {
      // Невалидный диапазон — сообщением, а не пустым экраном
      setPriceError("«От» больше «до» — проверьте диапазон.");
      return;
    }
    setPriceError("");
    onSetParams({
      price_min: min !== undefined ? String(min) : undefined,
      price_max: max !== undefined ? String(max) : undefined,
    });
  };

  const onPriceChange = (which: "min" | "max", v: string) => {
    const nextMin = which === "min" ? v : minDraft;
    const nextMax = which === "max" ? v : maxDraft;
    if (which === "min") setMinDraft(v);
    else setMaxDraft(v);
    if (defer) return; // в drawer применяем кнопкой
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => applyPrice(nextMin, nextMax), 600);
  };

  const toggleColorLocal = (v: string) => {
    if (defer) {
      setLocalColors((prev) => (prev.includes(v) ? prev.filter((c) => c !== v) : [...prev, v]));
    } else {
      onToggleColor(v);
    }
  };

  const allColors = facets?.colors ?? [];
  const filteredColors = colorQuery.trim()
    ? allColors.filter((c) => c.value.toLowerCase().includes(colorQuery.trim().toLowerCase()))
    : allColors;
  const shownColors =
    colorsExpanded || colorQuery.trim() ? filteredColors : filteredColors.slice(0, COLOR_LIST_COLLAPSED);

  return (
    <>
      <fieldset className="border border-line p-4">
        <legend className="px-1 text-xs font-semibold uppercase tracking-widest">Наличие</legend>
        <label className="flex min-h-[44px] cursor-pointer items-center gap-3 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4 accent-[#0D1115]"
            checked={curInStock}
            onChange={(e) => {
              if (defer) setLocalInStock(e.target.checked);
              else {
                onSetParams({ in_stock: e.target.checked ? "1" : undefined });
                track({ name: "apply_filter", filter: "in_stock", value: String(e.target.checked) });
              }
            }}
          />
          Только в наличии
        </label>
      </fieldset>

      <fieldset className="border border-line p-4">
        <legend className="px-1 text-xs font-semibold uppercase tracking-widest">Цена, ₽</legend>
        <div className="flex items-center gap-2">
          <label className="flex-1">
            <span className="sr-only">Цена от</span>
            <input
              type="number"
              min={0}
              inputMode="decimal"
              placeholder={facets?.priceMin != null ? `от ${facets.priceMin}` : "от"}
              value={minDraft}
              onChange={(e) => onPriceChange("min", e.target.value)}
              onBlur={() => !defer && applyPrice(minDraft, maxDraft)}
              onKeyDown={(e) => e.key === "Enter" && !defer && applyPrice(minDraft, maxDraft)}
              className="h-11 w-full border border-line px-3 text-sm focus:border-ink"
              aria-invalid={!!priceError}
            />
          </label>
          <span aria-hidden>—</span>
          <label className="flex-1">
            <span className="sr-only">Цена до</span>
            <input
              type="number"
              min={0}
              inputMode="decimal"
              placeholder={facets?.priceMax != null ? `до ${facets.priceMax}` : "до"}
              value={maxDraft}
              onChange={(e) => onPriceChange("max", e.target.value)}
              onBlur={() => !defer && applyPrice(minDraft, maxDraft)}
              onKeyDown={(e) => e.key === "Enter" && !defer && applyPrice(minDraft, maxDraft)}
              className="h-11 w-full border border-line px-3 text-sm focus:border-ink"
              aria-invalid={!!priceError}
            />
          </label>
        </div>
        {priceError ? (
          <p role="alert" className="mt-2 text-xs font-medium text-red-700">
            {priceError}
          </p>
        ) : null}
        {!defer && (
          <button
            type="button"
            className="mt-2 min-h-[44px] text-xs font-semibold uppercase tracking-wide underline"
            onClick={() => applyPrice(minDraft, maxDraft)}
          >
            Применить цену
          </button>
        )}
      </fieldset>

      {allColors.length > 0 && (
        <fieldset className="border border-line p-4">
          <legend className="px-1 text-xs font-semibold uppercase tracking-widest">Цвет</legend>
          {allColors.length > COLOR_LIST_COLLAPSED && (
            <div className="relative mb-2">
              <label htmlFor={defer ? "color-search-m" : "color-search"} className="sr-only">
                Поиск по цветам
              </label>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" aria-hidden />
              <input
                id={defer ? "color-search-m" : "color-search"}
                value={colorQuery}
                onChange={(e) => setColorQuery(e.target.value)}
                placeholder="Найти цвет…"
                className="h-11 w-full border border-line pl-9 pr-3 text-sm focus:border-ink"
              />
            </div>
          )}
          <ul className="max-h-64 space-y-1 overflow-y-auto">
            {shownColors.map((c) => (
              <li key={c.value}>
                <label className="flex min-h-[44px] cursor-pointer items-center gap-3 text-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-[#0D1115]"
                    checked={curColors.includes(c.value)}
                    onChange={() => toggleColorLocal(c.value)}
                  />
                  <span className="flex-1 capitalize">{c.value}</span>
                  <span className="text-xs text-neutral-400">{c.count}</span>
                </label>
              </li>
            ))}
            {shownColors.length === 0 && (
              <li className="py-2 text-sm text-neutral-500">Такого цвета нет в списке</li>
            )}
          </ul>
          {!colorQuery.trim() && allColors.length > COLOR_LIST_COLLAPSED && (
            <button
              type="button"
              className="mt-2 flex min-h-[44px] items-center gap-1 text-xs font-semibold uppercase tracking-wide underline"
              onClick={() => setColorsExpanded((v) => !v)}
              aria-expanded={colorsExpanded}
            >
              {colorsExpanded ? "Свернуть список" : `Показать все ${allColors.length}`}
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${colorsExpanded ? "rotate-180" : ""}`} aria-hidden />
            </button>
          )}
        </fieldset>
      )}

      {defer && onApply && (
        <button
          type="button"
          className="kp-btn-primary w-full"
          onClick={() =>
            onApply({
              inStock: localInStock,
              priceMin: minDraft === "" ? undefined : Number(minDraft),
              priceMax: maxDraft === "" ? undefined : Number(maxDraft),
              colors: localColors,
            })
          }
        >
          Показать результат
        </button>
      )}
    </>
  );
}

/** Мобильные фильтры: drawer с количеством выбранных условий и кнопкой применения. */
function MobileFilters({
  state,
  facets,
  activeCount,
  onToggleColor,
  onSetParams,
  onReset,
}: {
  state: FilterState;
  facets?: PanelProps["facets"];
  activeCount: number;
  onToggleColor: (v: string) => void;
  onSetParams: PanelProps["onSetParams"];
  onReset: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const prevActive = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>("button")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
      prevActive?.focus();
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="flex min-h-[44px] w-full items-center justify-center gap-2 border border-line bg-white px-4 text-sm font-semibold"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
      >
        <SlidersHorizontal className="h-4 w-4" aria-hidden />
        Фильтры{activeCount > 0 && ` (${activeCount})`}
      </button>
      {open && (
        <div className="fixed inset-0 z-[65] bg-ink/60" onClick={() => setOpen(false)} role="presentation">
          <div
            ref={ref}
            role="dialog"
            aria-modal="true"
            aria-label="Фильтры"
            className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto bg-white p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <p className="text-lg font-bold">Фильтры</p>
              <button
                type="button"
                className="flex h-11 w-11 items-center justify-center border border-line"
                aria-label="Закрыть фильтры"
                onClick={() => setOpen(false)}
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            <div className="space-y-4">
              <FiltersPanel
                defer
                state={state}
                facets={facets}
                onToggleColor={onToggleColor}
                onSetParams={onSetParams}
                onApply={(s) => {
                  const min = s.priceMin;
                  const max = s.priceMax;
                  if (min !== undefined && max !== undefined && min > max) return; // сообщение покажет панель
                  onSetParams({
                    in_stock: s.inStock ? "1" : undefined,
                    price_min: s.priceMin !== undefined ? String(s.priceMin) : undefined,
                    price_max: s.priceMax !== undefined ? String(s.priceMax) : undefined,
                    colors: s.colors.length ? s.colors.join(",") : undefined,
                  });
                  setOpen(false);
                }}
              />
              {activeCount > 0 && (
                <button
                  type="button"
                  className="kp-btn-outline w-full"
                  onClick={() => {
                    onReset();
                    setOpen(false);
                  }}
                >
                  Сбросить фильтры
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
