import { Link } from "react-router";
import { ShoppingCart, GitCompareArrows } from "lucide-react";
import { formatPrice, imageUrl, imageSrcSet } from "@/lib/format";
import { useCart } from "@/store/cart";
import { useCompare, COMPARE_LIMIT } from "@/store/compare";
import { useAnnouncer } from "@/components/Announcer";

export interface ProductCardData {
  sku: string;
  slug: string;
  title: string;
  price: string | null;
  stockStatus: "in_stock" | "out_of_stock" | "unknown";
  categoryName?: string | null;
  image?: {
    storageKey: string;
    alt: string | null;
    width: number | null;
    height: number | null;
    variants?: unknown;
  } | null;
}

export function ProductCard({ product }: { product: ProductCardData }) {
  const cart = useCart();
  const compare = useCompare();
  const { announce } = useAnnouncer();
  const img = imageUrl(product.image?.storageKey);
  const inCart = cart.lines.some((l) => l.sku === product.sku);
  const inCompare = compare.has(product.sku);

  return (
    <article className="group relative flex h-full flex-col border border-line bg-white transition-shadow duration-300 hover:shadow-lg">
      <Link
        to={`/product/${product.slug}`}
        className="flex flex-1 flex-col"
        aria-label={`${product.title}, артикул ${product.sku}`}
      >
        <div className="relative aspect-square overflow-hidden bg-fog">
          {img ? (
            <img
              src={img}
              srcSet={product.image ? imageSrcSet(product.image) : undefined}
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              alt={product.image?.alt ?? product.title}
              width={product.image?.width ?? 400}
              height={product.image?.height ?? 400}
              loading="lazy"
              className="h-full w-full object-contain p-4 transition-transform duration-300 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-xs uppercase tracking-widest text-neutral-400">
              Нет фото
            </div>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-1 p-4">
          <h3 className="line-clamp-2 min-h-[2.6em] text-sm font-medium leading-snug">
            {product.title}
          </h3>
          <p className="text-xs text-neutral-500">Арт: {product.sku}</p>
          <div className="mt-auto flex items-end justify-between pt-3">
            <div>
              <p className="text-lg font-bold leading-none">{formatPrice(product.price)}</p>
              <p className="mt-1 flex items-center gap-1.5 text-xs">
                <span
                  aria-hidden
                  className={`inline-block h-2 w-2 ${
                    product.stockStatus === "in_stock"
                      ? "bg-green-600"
                      : product.stockStatus === "out_of_stock"
                        ? "bg-red-600"
                        : "bg-neutral-400"
                  }`}
                />
                {product.stockStatus === "in_stock"
                  ? "В наличии"
                  : product.stockStatus === "out_of_stock"
                    ? "Нет в наличии"
                    : "Уточняйте наличие"}
              </p>
            </div>
          </div>
        </div>
      </Link>
      <div className="flex border-t border-line">
        <button
          type="button"
          disabled={product.stockStatus === "out_of_stock"}
          className={`flex h-11 flex-1 items-center justify-center gap-2 text-xs font-semibold uppercase tracking-wide transition-colors ${
            inCart ? "bg-ink text-brand" : "bg-brand text-ink hover:bg-ink hover:text-brand"
          } disabled:cursor-not-allowed disabled:bg-fog disabled:text-neutral-400`}
          onClick={() => {
            cart.add(
              {
                sku: product.sku,
                title: product.title,
                price: product.price,
                image: img,
              },
              1,
            );
            announce(`Товар «${product.title}» добавлен в корзину`);
          }}
        >
          <ShoppingCart className="h-4 w-4" aria-hidden />
          {inCart ? "В корзине" : "В корзину"}
        </button>
        <button
          type="button"
          aria-pressed={inCompare}
          aria-label={inCompare ? "Убрать из сравнения" : "Добавить к сравнению"}
          className={`flex h-11 w-11 items-center justify-center border-l border-line transition-colors hover:bg-fog ${
            inCompare ? "bg-ink text-brand" : ""
          }`}
          onClick={() => {
            const res = compare.toggle(product.sku);
            if (res === "limit") {
              announce(`Можно сравнивать не более ${COMPARE_LIMIT} товаров`);
            } else {
              announce(res === "added" ? "Добавлено к сравнению" : "Убрано из сравнения");
            }
          }}
        >
          <GitCompareArrows className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </article>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="flex h-full animate-pulse flex-col border border-line" aria-hidden>
      <div className="aspect-square bg-fog" />
      <div className="space-y-2 p-4">
        <div className="h-4 w-11/12 bg-fog" />
        <div className="h-4 w-2/3 bg-fog" />
        <div className="h-3 w-1/3 bg-fog" />
        <div className="h-6 w-1/2 bg-fog" />
      </div>
      <div className="h-11 border-t border-line bg-fog" />
    </div>
  );
}
