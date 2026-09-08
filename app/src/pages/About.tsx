import { Link } from "react-router";
import { Seo } from "@/lib/Seo";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { site } from "@/config/site";

export default function About() {
  return (
    <div className="kp-container py-8">
      <Seo
        title="О компании"
        description="KRAFTPAK — оптовый поставщик подарочной упаковки: коробки, пакеты, ленты, бумага. Бренды KRAFTPAK, NOVAROLL, UNIBOB."
        canonicalPath="/about"
      />
      <Breadcrumbs items={[{ label: "О компании" }]} />
      <h1 className="kp-h1 mt-6">О компании</h1>
      <div className="mt-8 grid gap-10 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-4 text-neutral-700">
          <p>
            {site.name} — поставщик подарочной и торговой упаковки для бизнеса:
            коробки, пакеты, ленты, бумага, флористические материалы и наполнитель.
          </p>
          <p>
            Работаем с оптовыми покупателями — магазинами, флористами,
            маркетплейсами и производителями. В ассортименте бренды{" "}
            {site.brands.join(", ")}.
          </p>
          <p>
            Наша продукция также доступна на маркетплейсах {site.marketplaces.join(" и ")}.
          </p>
        </div>
        <div className="grid content-start gap-px bg-line sm:grid-cols-2">
          {[
            ["Оптовые поставки", "Каталог с актуальными ценами и остатками из прайс-листа."],
            ["Брендирование", "Продукция с вашим логотипом — от макета до тиража."],
            ["Бренды в ассортименте", site.brands.join(", ") + "."],
            ["Маркетплейсы", "Продаём на " + site.marketplaces.join(" и ") + "."],
          ].map(([t, d]) => (
            <div key={t} className="bg-white p-6">
              <div className="mb-3 h-1.5 w-8 bg-brand" aria-hidden />
              <p className="font-bold">{t}</p>
              <p className="mt-1 text-sm text-neutral-600">{d}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-14 flex flex-wrap gap-4">
        <Link to="/catalog" className="kp-btn-primary">Перейти в каталог</Link>
        <Link to="/custom-logo" className="kp-btn-outline">Продукция с логотипом</Link>
      </div>
    </div>
  );
}
