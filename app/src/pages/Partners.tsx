import { Seo } from "@/lib/Seo";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { site } from "@/config/site";
import { Link } from "react-router";

export default function Partners() {
  return (
    <div className="kp-container py-8">
      <Seo
        title="Наши партнёры"
        description={`Продукция ${site.name} на маркетплейсах ${site.marketplaces.join(" и ")}. Сотрудничество для оптовых покупателей.`}
        canonicalPath="/partners"
      />
      <Breadcrumbs items={[{ label: "Наши партнёры" }]} />
      <h1 className="kp-h1 mt-6">Наши партнёры</h1>
      <div className="mt-8 grid gap-10 lg:grid-cols-2">
        <section aria-labelledby="mp-h">
          <h2 id="mp-h" className="text-xl font-bold">Мы на маркетплейсах</h2>
          <ul className="mt-4 grid gap-px bg-line sm:grid-cols-2">
            {site.marketplaces.map((m) => (
              <li key={m} className="bg-white p-6">
                <p className="text-lg font-bold">{m}</p>
                <p className="mt-1 text-sm text-neutral-600">
                  Наша продукция представлена на площадке {m}. Прямую ссылку на магазин
                  даст менеджер — по телефону или почте.
                </p>
              </li>
            ))}
          </ul>
        </section>
        <section aria-labelledby="coop-h" className="bg-ink p-8 text-white">
          <h2 id="coop-h" className="text-xl font-bold">Сотрудничество</h2>
          <p className="mt-3 text-white/75">
            Приглашаем оптовых покупателей: магазины упаковки, флористические
            студии, сувенирные компании. Предложим условия под ваш объём.
          </p>
          <a href={`mailto:${site.email}`} className="kp-btn-primary mt-6">
            Написать нам
          </a>
        </section>
      </div>
      <Link to="/catalog" className="kp-btn-outline mt-10">Перейти в каталог</Link>
    </div>
  );
}
