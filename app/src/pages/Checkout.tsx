import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";
import { Seo } from "@/lib/Seo";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { useCart } from "@/store/cart";
import { formatPrice } from "@/lib/format";
import { track } from "@/lib/analytics";

type Errors = Partial<Record<string, string>>;

export default function Checkout() {
  const cart = useCart();
  const navigate = useNavigate();
  const createOrder = trpc.order.create.useMutation();
  const [form, setForm] = useState({
    customerName: "",
    phone: "",
    email: "",
    company: "",
    inn: "",
    address: "",
    deliveryMethod: "Самовывоз",
    comment: "",
    consent: false,
    honeypot: "",
  });
  const [errors, setErrors] = useState<Errors>({});

  useEffect(() => {
    if (cart.lines.length > 0) track({ name: "begin_checkout", items: cart.count });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value }));

  const validate = (): boolean => {
    const e: Errors = {};
    if (form.customerName.trim().length < 2) e.customerName = "Укажите имя";
    if (!/^[+()\- 0-9]{10,20}$/.test(form.phone.trim())) e.phone = "Укажите корректный телефон";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) e.email = "Укажите корректный email";
    if (!form.consent) e.consent = "Требуется согласие на обработку персональных данных";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    try {
      const res = await createOrder.mutateAsync({
        customerName: form.customerName,
        phone: form.phone,
        email: form.email,
        company: form.company || undefined,
        inn: form.inn || undefined,
        address: form.address || undefined,
        deliveryMethod: form.deliveryMethod || undefined,
        comment: form.comment || undefined,
        consent: true,
        honeypot: form.honeypot,
        items: cart.lines.map((l) => ({ sku: l.sku, quantity: l.quantity })),
      });
      track({ name: "order_success", number: res.number });
      cart.clear();
      navigate(`/checkout/success?number=${encodeURIComponent(res.number)}&total=${encodeURIComponent(res.total)}`);
    } catch (err) {
      setErrors({ submit: err instanceof Error ? err.message : "Не удалось отправить заявку. Попробуйте ещё раз." });
    }
  };

  const field = (
    id: string,
    label: string,
    key: keyof typeof form,
    opts: { type?: string; required?: boolean; autoComplete?: string; hint?: string } = {},
  ) => (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium">
        {label} {opts.required && <span className="text-red-700" aria-hidden>*</span>}
      </label>
      <input
        id={id}
        type={opts.type ?? "text"}
        value={String(form[key])}
        onChange={set(key)}
        autoComplete={opts.autoComplete}
        aria-invalid={!!errors[key]}
        aria-describedby={errors[key] ? `${id}-err` : opts.hint ? `${id}-hint` : undefined}
        className={`h-12 w-full border px-4 text-sm focus:outline-none ${
          errors[key] ? "border-red-600" : "border-line focus:border-ink"
        }`}
      />
      {opts.hint && (
        <p id={`${id}-hint`} className="mt-1 text-xs text-neutral-500">
          {opts.hint}
        </p>
      )}
      {errors[key] && (
        <p id={`${id}-err`} role="alert" className="mt-1 text-sm font-medium text-red-700">
          {errors[key]}
        </p>
      )}
    </div>
  );

  return (
    <div className="kp-container py-8">
      <Seo title="Оформление заявки" noindex canonicalPath="/checkout" />
      <Breadcrumbs items={[{ label: "Корзина", to: "/cart" }, { label: "Оформление заявки" }]} />
      <h1 className="kp-h1 mt-6">Оформление заявки</h1>
      <p className="mt-3 max-w-2xl text-sm text-neutral-600">
        Это заявка, а не онлайн-оплата: менеджер подтвердит наличие, стоимость и способ получения.
      </p>

      {cart.lines.length === 0 ? (
        <div className="mt-10 border border-line p-10 text-center">
          <p className="text-lg font-bold">Корзина пуста</p>
          <Link to="/catalog" className="kp-btn-primary mt-6">
            Перейти в каталог
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-10 grid gap-10 lg:grid-cols-[1fr_360px]" noValidate={false}>
          <div className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              {field("co-name", "Имя", "customerName", { required: true, autoComplete: "name" })}
              {field("co-phone", "Телефон", "phone", { type: "tel", required: true, autoComplete: "tel" })}
            </div>
            {field("co-email", "Email", "email", { type: "email", required: true, autoComplete: "email" })}
            <div className="grid gap-5 sm:grid-cols-2">
              {field("co-company", "Название компании", "company", { autoComplete: "organization" })}
              {field("co-inn", "ИНН", "inn", { hint: "Необязательно — для счёта юрлицу" })}
            </div>
            {field("co-address", "Город / адрес или комментарий по доставке", "address", { autoComplete: "street-address" })}
            <div>
              <label htmlFor="co-delivery" className="mb-1 block text-sm font-medium">
                Способ получения
              </label>
              <select
                id="co-delivery"
                value={form.deliveryMethod}
                onChange={set("deliveryMethod")}
                className="h-12 w-full border border-line bg-white px-4 text-sm focus:border-ink"
              >
                <option>Самовывоз</option>
                <option>Доставка — обсудить с менеджером</option>
              </select>
            </div>
            <div>
              <label htmlFor="co-comment" className="mb-1 block text-sm font-medium">
                Комментарий
              </label>
              <textarea
                id="co-comment"
                value={form.comment}
                onChange={set("comment")}
                rows={4}
                className="w-full border border-line px-4 py-3 text-sm focus:border-ink"
              />
            </div>
            {/* Honeypot */}
            <input
              type="text"
              value={form.honeypot}
              onChange={set("honeypot")}
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              className="sr-only"
              name="website"
            />
            <div>
              <label className="flex items-start gap-3 text-sm text-neutral-600">
                <input
                  type="checkbox"
                  checked={form.consent}
                  onChange={set("consent")}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[#0D1115]"
                  aria-invalid={!!errors.consent}
                />
                <span>
                  Соглашаюсь с{" "}
                  <Link to="/privacy-policy" className="underline">
                    политикой обработки персональных данных
                  </Link>{" "}
                  <span className="text-red-700" aria-hidden>
                    *
                  </span>
                </span>
              </label>
              {errors.consent && (
                <p role="alert" className="mt-1 text-sm font-medium text-red-700">
                  {errors.consent}
                </p>
              )}
            </div>
            {errors.submit && (
              <p role="alert" className="border border-red-600 bg-red-50 p-3 text-sm font-medium text-red-700">
                {errors.submit}
              </p>
            )}
          </div>

          <aside className="h-fit border border-line p-6 lg:sticky lg:top-24" aria-label="Состав заявки">
            <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500">Ваша заявка</p>
            <ul className="mt-4 max-h-64 space-y-2 overflow-y-auto text-sm">
              {cart.lines.map((l) => (
                <li key={l.sku} className="flex justify-between gap-3">
                  <span className="min-w-0 truncate">{l.title}</span>
                  <span className="whitespace-nowrap text-neutral-500">×{l.quantity}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 border-t border-line pt-4 text-2xl font-extrabold">{formatPrice(cart.total)}</p>
            <p className="mt-2 text-xs text-neutral-500">
              Наличие и итог подтверждаются менеджером.
            </p>
            <button
              type="submit"
              disabled={createOrder.isPending}
              className="kp-btn-primary mt-6 w-full disabled:opacity-50"
            >
              {createOrder.isPending ? "Отправка…" : "Отправить заявку"}
            </button>
          </aside>
        </form>
      )}
    </div>
  );
}
