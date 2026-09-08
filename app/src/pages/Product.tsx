import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import { X, ZoomIn } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { Seo } from "@/lib/Seo";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { ProductCard, ProductCardSkeleton } from "@/components/ProductCard";
import { QuantityInput } from "@/components/QuantityInput";
import { ConsultationForm } from "@/components/ConsultationForm";
import { useCart } from "@/store/cart";
import { useCompare, COMPARE_LIMIT } from "@/store/compare";
import { useAnnouncer } from "@/components/Announcer";
import { formatPrice, imageUrl, imageSrcSet, formatDateRu } from "@/lib/format";
import { track } from "@/lib/analytics";
import NotFound from "./NotFound";

const ATTR_LABELS: Record<string, string> = {
  dimensions: "Размеры",
  color: "Цвет",
  shape: "Форма",
  material: "Материал",
  construction: "Конструкция",
  design: "Оформление",
  purpose: "Назначение",
  packing: "Упаковка",
  set_count: "Количество в наборе",
  finish: "Отделка",
};

export default function Product() {
  const { slug } = useParams<{ slug: string }>();
  const { data, isLoading } = trpc.catalog.productBySlug.useQuery(
    { slug: slug ?? "" },
    { enabled: !!slug },
  );
  const related = trpc.catalog.relatedProducts.useQuery(
    { productId: data?.product.id ?? 0, limit: 8 },
    { enabled: !!data },
  );

  const cart = useCart();
  const compare = useCompare();
  const { announce } = useAnnouncer();
  const [qty, setQty] = useState(1);
  const [activeImage, setActiveImage] = useState(0);
  const [lightbox, setLightbox] = useState(false);

  // Просмотренные товары (localStorage, без персональных данных)
  useEffect(() => {
    if (!data) return;
    track({ name: "view_product", sku: data.product.sku });
    try {
      const key = "kraftpak_recent";
      const prev: Array<{ sku: string; slug: string; title: string; price: string | null; image: string | null }> =
        JSON.parse(localStorage.getItem(key) ?? "[]");
      const entry = {
        sku: data.product.sku,
        slug: data.product.slug,
        title: data.product.title,
        price: data.product.price,
        image: imageUrl(data.images[0]?.storageKey),
      };
      const next = [entry, ...prev.filter((x) => x.sku !== entry.sku)].slice(0, 12);
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      /* noop */
    }
  }, [data?.product.sku]);

  const jsonLd = useMemo(() => {
    if (!data) return undefined;
    const p = data.product;
    const productSchema: Record<string, unknown> = {
      "@context": "https://schema.org",
      "@type": "Product",
      name: p.title,
      sku: p.sku,
      image: data.images.map((i) => imageUrl(i.storageKey)).filter(Boolean),
    };
    const schemas: object[] = [productSchema];
    if (p.price !== null) {
      productSchema.offers = {
        "@type": "Offer",
        price: p.price,
        priceCurrency: p.currency,
        availability:
          p.stockStatus === "in_stock"
            ? "https://schema.org/InStock"
            : "https://schema.org/OutOfStock",
      };
    }
    return schemas;
  }, [data]);

  if (isLoading) {
    return (
      <div className="kp-container py-8">
        <div className="h-5 w-64 animate-pulse bg-fog" />
        <div className="mt-8 grid gap-10 lg:grid-cols-2">
          <div className="aspect-square animate-pulse bg-fog" />
          <div className="space-y-4">
            <div className="h-10 w-3/4 animate-pulse bg-fog" />
            <div className="h-6 w-1/3 animate-pulse bg-fog" />
            <div className="h-12 w-1/2 animate-pulse bg-fog" />
          </div>
        </div>
      </div>
    );
  }
  if (!data) return <NotFound />;

  const { product: p, images, attributes, hasInferredAttributes, units, breadcrumbs, displayTitle, displayDims } = data;
  const current = images[activeImage];
  const inCart = cart.lines.some((l) => l.sku === p.sku);

  return (
    <div className="kp-container py-8">
      <Seo
        title={p.title}
        description={`${p.title} — артикул ${p.sku}. ${formatPrice(p.price)}. Каталог KRAFTPAK.`}
        canonicalPath={`/product/${p.slug}`}
        ogImage={imageUrl(images[0]?.storageKey)}
        jsonLd={jsonLd}
      />

      <Breadcrumbs
        items={[
          { label: "Каталог", to: "/catalog" },
          ...breadcrumbs.map((c) => ({ label: c.name, to: `/catalog/${c.slug}` })),
          { label: p.title },
        ]}
      />

      <div className="mt-8 grid gap-10 lg:grid-cols-2">
        {/* Галерея */}
        <div>
          <button
            type="button"
            className="relative block aspect-square w-full border border-line bg-fog"
            onClick={() => setLightbox(true)}
            aria-label="Увеличить изображение"
          >
            {current ? (
              <img
                src={imageUrl(current.storageKey) ?? ""}
                srcSet={imageSrcSet(current)}
                sizes="(max-width: 1024px) 100vw, 50vw"
                alt={current.alt ?? p.title}
                width={current.width ?? 600}
                height={current.height ?? 600}
                className="h-full w-full object-contain p-6"
              />
            ) : (
              <span className="flex h-full items-center justify-center text-sm uppercase tracking-widest text-neutral-400">
                Нет фото
              </span>
            )}
            <span className="absolute bottom-3 right-3 flex h-10 w-10 items-center justify-center bg-white/90">
              <ZoomIn className="h-4 w-4" aria-hidden />
            </span>
          </button>
          {images.length > 1 && (
            <ul className="mt-3 flex gap-2">
              {images.map((img, i) => (
                <li key={img.id}>
                  <button
                    type="button"
                    onClick={() => setActiveImage(i)}
                    aria-label={`Изображение ${i + 1}`}
                    aria-current={i === activeImage}
                    className={`h-16 w-16 border bg-fog ${i === activeImage ? "border-ink" : "border-line"}`}
                  >
                    <img
                      src={imageUrl(img.storageKey) ?? ""}
                      alt=""
                      width={64}
                      height={64}
                      className="h-full w-full object-contain p-1"
                      loading="lazy"
                    />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Информация */}
        <div>
          {breadcrumbs.length > 0 && (
            <Link
              to={`/catalog/${breadcrumbs[breadcrumbs.length - 1].slug}`}
              className="text-xs font-semibold uppercase tracking-widest text-neutral-500 hover:text-ink"
            >
              {breadcrumbs[breadcrumbs.length - 1].name}
            </Link>
          )}
          <h1 className="mt-2 text-2xl font-extrabold leading-tight md:text-4xl">{displayTitle}</h1>
          {displayDims && <p className="mt-2 text-base text-neutral-600">Размеры: {displayDims}</p>}
          <p className="mt-2 text-sm text-neutral-500">Артикул: {p.sku}</p>

          <div className="mt-6 flex flex-wrap items-center gap-4">
            <div>
              <p className="text-3xl font-extrabold">
                {formatPrice(p.price)}
                {p.price !== null && units.unitSale && (
                  <span className="text-xl font-bold text-neutral-500"> / {units.unitSale}</span>
                )}
              </p>
              {p.price !== null && !units.unitSale && (
                <p className="mt-1 text-xs text-neutral-500">
                  Единицу продажи и кратность уточнит менеджер
                </p>
              )}
              {(units.pack || units.box) && (
                <p className="mt-1 text-xs text-neutral-500">
                  {[
                    units.pack ? `В упаковке: ${units.pack.qty} ${units.pack.unit}` : null,
                    units.box ? `В коробке: ${units.box.qty} ${units.box.unit}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}
            </div>
            <p className="flex items-center gap-2 text-sm">
              <span
                aria-hidden
                className={`inline-block h-2.5 w-2.5 ${
                  p.stockStatus === "in_stock"
                    ? "bg-green-600"
                    : p.stockStatus === "out_of_stock"
                      ? "bg-red-600"
                      : "bg-neutral-400"
                }`}
              />
              {p.stockStatus === "in_stock"
                ? p.stockQuantity !== null
                  ? `В наличии (${p.stockQuantity} шт.)`
                  : "В наличии"
                : p.stockStatus === "out_of_stock"
                  ? "Нет в наличии"
                  : "Наличие уточняйте"}
            </p>
          </div>
          {p.sourceUpdatedAt && (
            <p className="mt-1 text-xs text-neutral-400">
              Цены обновлены {formatDateRu(p.sourceUpdatedAt)}. Фактическое наличие подтверждает менеджер.
            </p>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <QuantityInput value={qty} onChange={setQty} label="Количество" />
            {p.price === null ? (
              <a href="#consult-product" className="kp-btn-primary flex-1 sm:flex-none">
                Запросить расчёт
              </a>
            ) : (
              <button
                type="button"
                disabled={p.stockStatus === "out_of_stock"}
                className={`kp-btn-primary flex-1 sm:flex-none ${p.stockStatus === "out_of_stock" ? "!cursor-not-allowed !bg-fog !text-neutral-400" : ""}`}
                onClick={() => {
                  cart.add(
                    { sku: p.sku, title: p.title, price: p.price, image: imageUrl(images[0]?.storageKey) },
                    qty,
                  );
                  announce(`Добавлено в корзину: ${p.title}, ${qty} шт.`);
                }}
              >
                {inCart ? "Добавить ещё" : "В корзину"}
              </button>
            )}
            <button
              type="button"
              aria-pressed={compare.has(p.sku)}
              className="kp-btn-outline"
              onClick={() => {
                const res = compare.toggle(p.sku);
                announce(
                  res === "limit"
                    ? `Можно сравнивать не более ${COMPARE_LIMIT} товаров`
                    : res === "added"
                      ? "Добавлено к сравнению"
                      : "Убрано из сравнения",
                );
              }}
            >
              {compare.has(p.sku) ? "В сравнении" : "Сравнить"}
            </button>
          </div>

          {/* Характеристики */}
          {attributes.length > 0 && (
            <section className="mt-10" aria-labelledby="attr-h">
              <h2 id="attr-h" className="text-lg font-bold">
                Характеристики
              </h2>
              <dl className="mt-4 divide-y divide-line border-y border-line text-sm">
                {attributes.map((a) => (
                  <div key={a.id} className="grid grid-cols-2 gap-4 py-2.5">
                    <dt className="text-neutral-500">{ATTR_LABELS[a.key] ?? a.key}</dt>
                    <dd className="font-medium">{a.value}</dd>
                  </div>
                ))}
              </dl>
              {hasInferredAttributes && (
                <p className="mt-2 text-xs text-neutral-400">
                  Часть характеристик распознана автоматически из названия и уточняется менеджером.
                </p>
              )}
            </section>
          )}

          {/* Описание показываем только если оно уникально — иначе не дублируем название */}
          {p.description && (
            <section className="mt-8" aria-labelledby="desc-h">
              <h2 id="desc-h" className="text-lg font-bold">
                Описание
              </h2>
              <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-neutral-700">
                {p.description}
              </p>
            </section>
          )}

          <section className="mt-8 border border-line p-5" aria-labelledby="dlv-h">
            <h2 id="dlv-h" className="text-sm font-bold uppercase tracking-widest">
              Доставка и оплата
            </h2>
            <p className="mt-2 text-sm text-neutral-600">
              Условия и стоимость уточняет менеджер при подтверждении заказа.{" "}
              <Link to="/delivery-payment" className="underline">
                Подробнее
              </Link>
            </p>
          </section>
        </div>
      </div>

      {/* Связанные товары */}
      {related.data && related.data.length > 0 && (
        <section className="mt-16" aria-labelledby="rel-h">
          <h2 id="rel-h" className="kp-h2 mb-8">
            Похожие товары
          </h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {related.isLoading
              ? Array.from({ length: 4 }).map((_, i) => <ProductCardSkeleton key={i} />)
              : related.data.map((x) => <ProductCard key={x.sku} product={x} />)}
          </div>
        </section>
      )}

      {/* Просмотренные товары */}
      <RecentlyViewed excludeSku={p.sku} />

      {/* Консультация: SKU и URL товара прикладываются к обращению автоматически */}
      <section id="consult-product" className="mt-16 grid gap-8 border border-line p-6 md:grid-cols-2 md:p-10">
        <div>
          <h2 className="kp-h2">Вопрос по товару?</h2>
          <p className="mt-3 text-sm text-neutral-600">
            Поможем с наличием, кратностью упаковки и условиями заказа.
            К обращению приложатся артикул {p.sku} и ссылка на этот товар.
          </p>
        </div>
        <ConsultationForm
          title=""
          context={`product-${p.sku}`}
          productSku={p.sku}
          productUrl={`/product/${p.slug}`}
        />
      </section>

      {/* Lightbox */}
      {lightbox && current && (
        <Lightbox
          src={imageUrl(current.storageKey) ?? ""}
          alt={current.alt ?? p.title}
          naturalWidth={current.width}
          onClose={() => setLightbox(false)}
        />
      )}
    </div>
  );
}

function Lightbox({ src, alt, naturalWidth, onClose }: { src: string; alt: string; naturalWidth: number | null; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    ref.current?.querySelector<HTMLElement>("button")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
      prev?.focus();
    };
  }, [onClose]);

  // Небольшое исходное фото не растягиваем больше чем в 3 раза и честно об этом говорим
  const small = naturalWidth != null && naturalWidth <= 128;
  const style: React.CSSProperties = small && naturalWidth
    ? { maxWidth: `min(90vw, ${naturalWidth * 3}px)`, maxHeight: "80vh" }
    : { maxWidth: "90vw", maxHeight: "90vh" };

  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-label="Увеличенное изображение"
      className="fixed inset-0 z-[70] flex flex-col items-center justify-center bg-ink/90 p-4"
      onClick={onClose}
    >
      <button
        type="button"
        className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center bg-white text-ink"
        onClick={onClose}
        aria-label="Закрыть"
      >
        <X className="h-5 w-5" aria-hidden />
      </button>
      <img
        src={src}
        alt={alt}
        style={style}
        className="object-contain"
        onClick={(e) => e.stopPropagation()}
      />
      {small && (
        <p className="mt-4 max-w-md text-center text-xs text-white/60">
          Исходное фото небольшое — снимок из прайс-листа. Оригинал высокого разрешения можно запросить у менеджера.
        </p>
      )}
    </div>
  );
}


/** Недавно просмотренные (localStorage, без персональных данных). */
function RecentlyViewed({ excludeSku }: { excludeSku: string }) {
  const [items] = useState<
    Array<{ sku: string; slug: string; title: string; price: string | null; image: string | null }>
  >(() => {
    try {
      const raw = localStorage.getItem("kraftpak_recent");
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr.filter((x) => x.sku !== excludeSku).slice(0, 6) : [];
    } catch {
      return [];
    }
  });
  if (!items.length) return null;
  return (
    <section className="mt-16" aria-labelledby="recent-h">
      <h2 id="recent-h" className="kp-h2 mb-8">
        Вы смотрели
      </h2>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {items.map((x) => (
          <Link
            key={x.sku}
            to={`/product/${x.slug}`}
            className="border border-line p-3 transition-shadow hover:shadow-md"
          >
            <div className="aspect-square bg-fog">
              {x.image ? (
                <img
                  src={x.image}
                  alt=""
                  width={160}
                  height={160}
                  loading="lazy"
                  className="h-full w-full object-contain p-2"
                />
              ) : null}
            </div>
            <p className="mt-2 line-clamp-2 text-xs leading-snug">{x.title}</p>
            <p className="mt-1 text-sm font-bold">{formatPrice(x.price)}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
