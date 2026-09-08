import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Trash2 } from "lucide-react";
import { Seo } from "@/lib/Seo";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { QuantityInput } from "@/components/QuantityInput";
import { useCart } from "@/store/cart";
import { useAnnouncer } from "@/components/Announcer";
import { formatPrice } from "@/lib/format";
import { productsCount } from "@/lib/format";

export default function Cart() {
  const cart = useCart();
  const { announce } = useAnnouncer();
  const [undo, setUndo] = useState<{ sku: string; snapshot: (typeof cart.lines)[number] } | null>(null);

  useEffect(() => {
    if (!undo) return;
    const t = setTimeout(() => setUndo(null), 6000);
    return () => clearTimeout(t);
  }, [undo]);

  const removeWithUndo = (sku: string) => {
    const line = cart.lines.find((l) => l.sku === sku);
    if (!line) return;
    cart.remove(sku);
    setUndo({ sku, snapshot: line });
    announce(`Товар «${line.title}» удалён из корзины`);
  };

  return (
    <div className="kp-container py-8">
      <Seo title="Корзина" noindex canonicalPath="/cart" />
      <Breadcrumbs items={[{ label: "Корзина" }]} />
      <h1 className="kp-h1 mt-6">Корзина</h1>

      {cart.lines.length === 0 ? (
        <div className="mt-10 border border-line p-10 text-center">
          <p className="text-lg font-bold">Корзина пуста</p>
          <p className="mt-2 text-sm text-neutral-600">Выберите упаковку в каталоге.</p>
          <Link to="/catalog" className="kp-btn-primary mt-6">
            Перейти в каталог
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_360px]">
          <ul className="divide-y divide-line border-y border-line">
            {cart.lines.map((l) => (
              <li key={l.sku} className="grid grid-cols-[64px_1fr] gap-4 py-4 sm:grid-cols-[88px_1fr_auto] sm:items-center">
                <div className="aspect-square border border-line bg-fog">
                  {l.image ? (
                    <img src={l.image} alt="" width={88} height={88} className="h-full w-full object-contain p-1" />
                  ) : (
                    <span className="flex h-full items-center justify-center text-[10px] uppercase text-neutral-400">
                      нет фото
                    </span>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium leading-snug">{l.title}</p>
                  <p className="mt-1 text-xs text-neutral-500">Арт: {l.sku}</p>
                  <p className="mt-1 text-sm font-semibold">{formatPrice(l.price)}</p>
                  <div className="mt-3 sm:hidden">
                    <QuantityInput
                      value={l.quantity}
                      onChange={(v) => cart.setQuantity(l.sku, v)}
                      label={`Количество: ${l.title}`}
                    />
                  </div>
                </div>
                <div className="col-span-2 flex items-center justify-between gap-4 sm:col-span-1 sm:flex-col sm:items-end">
                  <div className="hidden sm:block">
                    <QuantityInput
                      value={l.quantity}
                      onChange={(v) => cart.setQuantity(l.sku, v)}
                      label={`Количество: ${l.title}`}
                    />
                  </div>
                  <p className="text-base font-bold">
                    {l.price !== null
                      ? formatPrice(
                          (() => {
                            const [i, f = ""] = l.price.split(".");
                            const cents = (BigInt(i) * 100n + BigInt((f + "00").slice(0, 2))) * BigInt(l.quantity);
                            return `${cents / 100n}.${(cents % 100n).toString().padStart(2, "0")}`;
                          })(),
                        )
                      : "Цена по запросу"}
                  </p>
                  <button
                    type="button"
                    className="flex h-11 w-11 items-center justify-center border border-line text-neutral-500 hover:border-ink hover:text-ink"
                    aria-label={`Удалить ${l.title} из корзины`}
                    onClick={() => removeWithUndo(l.sku)}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <aside className="h-fit border border-line p-6 lg:sticky lg:top-24" aria-label="Итого">
            <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500">Итого</p>
            <p className="mt-2 text-sm text-neutral-600">{productsCount(cart.count)}</p>
            <p className="mt-2 text-3xl font-extrabold">{formatPrice(cart.total)}</p>
            <p className="mt-3 text-xs text-neutral-500">
              Цена и наличие подтверждаются менеджером после оформления заявки.
            </p>
            <Link to="/checkout" className="kp-btn-primary mt-6 w-full">
              Оформить заявку
            </Link>
            <Link to="/catalog" className="mt-3 block text-center text-sm underline">
              Продолжить покупки
            </Link>
          </aside>
        </div>
      )}

      {/* Отмена удаления */}
      {undo && (
        <div
          role="status"
          className="fixed bottom-4 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-4 bg-ink px-5 py-3 text-sm text-white shadow-xl"
        >
          <span>Товар удалён</span>
          <button
            type="button"
            className="font-semibold text-brand underline"
            onClick={() => {
              cart.add(undo.snapshot, undo.snapshot.quantity);
              setUndo(null);
            }}
          >
            Отменить
          </button>
        </div>
      )}
    </div>
  );
}
