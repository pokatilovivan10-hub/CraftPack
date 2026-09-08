import { useMemo, useState } from "react";
import { Link } from "react-router";
import { X } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { Seo } from "@/lib/Seo";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { useCompare } from "@/store/compare";
import { useCart } from "@/store/cart";
import { formatPrice, imageUrl } from "@/lib/format";
import { useAnnouncer } from "@/components/Announcer";

const ATTR_LABELS: Record<string, string> = {
  dimensions: "Размеры",
  color: "Цвет",
  shape: "Форма",
  packing: "Упаковка",
  set_count: "Количество в наборе",
  finish: "Отделка",
};

export default function Compare() {
  const compare = useCompare();
  const cart = useCart();
  const { announce } = useAnnouncer();
  const [onlyDiff, setOnlyDiff] = useState(false);

  const { data: items, isLoading } = trpc.catalog.bySkus.useQuery(
    { skus: compare.skus },
    { enabled: compare.skus.length > 0 },
  );

  // Порядок как в списке выбора
  const products = useMemo(
    () => compare.skus.map((s) => items?.find((p) => p.sku === s)).filter(Boolean) ?? [],
    [compare.skus, items],
  ) as NonNullable<typeof items>;

  const categories = new Set(products.map((p) => p.categoryId));
  const mixedCategories = categories.size > 1;

  const attrKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const p of products) for (const a of p.attributes) keys.add(a.key);
    return [...keys];
  }, [products]);

  const diffKeys = useMemo(() => {
    if (!onlyDiff) return attrKeys;
    return attrKeys.filter((k) => {
      const vals = new Set(products.map((p) => p.attributes.find((a) => a.key === k)?.value ?? "—"));
      return vals.size > 1;
    });
  }, [attrKeys, onlyDiff, products]);

  return (
    <div className="kp-container py-8">
      <Seo title="Сравнение товаров" noindex canonicalPath="/compare" />
      <Breadcrumbs items={[{ label: "Сравнение" }]} />
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="kp-h1">Сравнение</h1>
        {products.length > 0 && (
          <label className="flex min-h-[44px] items-center gap-3 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4 accent-[#0D1115]"
              checked={onlyDiff}
              onChange={(e) => setOnlyDiff(e.target.checked)}
            />
            Показывать только различия
          </label>
        )}
      </div>

      {mixedCategories && products.length > 0 && (
        <p role="status" className="mt-6 border border-amber-400 bg-amber-50 p-3 text-sm">
          Вы сравниваете товары из разных категорий — часть характеристик может не совпадать по смыслу.
        </p>
      )}

      {compare.skus.length === 0 ? (
        <div className="mt-10 border border-line p-10 text-center">
          <p className="text-lg font-bold">Список сравнения пуст</p>
          <p className="mt-2 text-sm text-neutral-600">
            Добавляйте товары кнопкой «Сравнить» в каталоге (до 4 одновременно).
          </p>
          <Link to="/catalog" className="kp-btn-primary mt-6">
            Перейти в каталог
          </Link>
        </div>
      ) : isLoading ? (
        <div className="mt-10 h-64 animate-pulse bg-fog" aria-hidden />
      ) : (
        <div className="mt-8 overflow-x-auto" role="region" aria-label="Таблица сравнения" tabIndex={0}>
          <table className="w-full min-w-[720px] border-collapse border border-line text-sm">
            <thead>
              <tr>
                <th scope="col" className="sticky left-0 z-10 w-44 border border-line bg-fog p-3 text-left align-top">
                  Товар
                </th>
                {products.map((p) => (
                  <th key={p.sku} scope="col" className="w-56 border border-line p-3 align-top font-normal">
                    <div className="relative">
                      <button
                        type="button"
                        className="absolute right-0 top-0 flex h-8 w-8 items-center justify-center border border-line bg-white hover:bg-fog"
                        aria-label={`Убрать ${p.title} из сравнения`}
                        onClick={() => {
                          compare.remove(p.sku);
                          announce("Товар убран из сравнения");
                        }}
                      >
                        <X className="h-4 w-4" aria-hidden />
                      </button>
                      <Link to={`/product/${p.slug}`} className="block pr-9">
                        <div className="mx-auto h-28 w-28 bg-fog">
                          {p.image ? (
                            <img
                              src={imageUrl(p.image.storageKey) ?? ""}
                              alt=""
                              width={112}
                              height={112}
                              className="h-full w-full object-contain p-1"
                              loading="lazy"
                            />
                          ) : null}
                        </div>
                        <span className="mt-2 line-clamp-2 block font-medium hover:underline">{p.title}</span>
                      </Link>
                      <span className="mt-1 block text-xs text-neutral-500">Арт: {p.sku}</span>
                      <span className="mt-2 block text-base font-bold">{formatPrice(p.price)}</span>
                      <button
                        type="button"
                        className="kp-btn-primary mt-3 w-full !min-h-[44px] !px-2 !py-1 text-[11px]"
                        disabled={p.stockStatus === "out_of_stock"}
                        onClick={() => {
                          cart.add(
                            { sku: p.sku, title: p.title, price: p.price, image: imageUrl(p.image?.storageKey) },
                            1,
                          );
                          announce("Добавлено в корзину");
                        }}
                      >
                        В корзину
                      </button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row" className="sticky left-0 border border-line bg-fog p-3 text-left font-medium">
                  Наличие
                </th>
                {products.map((p) => (
                  <td key={p.sku} className="border border-line p-3 text-center">
                    {p.stockStatus === "in_stock"
                      ? p.stockQuantity !== null
                        ? `В наличии (${p.stockQuantity} шт.)`
                        : "В наличии"
                      : p.stockStatus === "out_of_stock"
                        ? "Нет в наличии"
                        : "Уточняйте"}
                  </td>
                ))}
              </tr>
              {diffKeys.map((k) => (
                <tr key={k}>
                  <th scope="row" className="sticky left-0 border border-line bg-fog p-3 text-left font-medium">
                    {ATTR_LABELS[k] ?? k}
                  </th>
                  {products.map((p) => (
                    <td key={p.sku} className="border border-line p-3 text-center">
                      {p.attributes.find((a) => a.key === k)?.value ?? "—"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
