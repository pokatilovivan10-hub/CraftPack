import { Link } from "react-router";
import { footerCatalog, footerCompany, site } from "@/config/site";

export function Footer() {
  return (
    <footer className="mt-24 bg-ink text-white">
      <div className="kp-container grid gap-10 py-14 md:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-2xl font-extrabold">
            KRAFT<span className="bg-brand px-1 text-ink">PAK</span>
          </p>
          <p className="mt-3 text-sm text-white/70">{site.tagline}</p>
          <address className="mt-6 space-y-2 text-sm not-italic text-white/80">
            <p>{site.address}</p>
            <p>
              <a href={site.phoneHref} className="font-semibold text-brand hover:underline">
                {site.phone}
              </a>
            </p>
            <p>
              <a href={`mailto:${site.email}`} className="hover:underline">
                {site.email}
              </a>
            </p>
            <p>{site.workHours}</p>
          </address>
        </div>
        <nav aria-label="Каталог в подвале">
          <p className="text-xs font-semibold uppercase tracking-widest text-white/50">Каталог</p>
          <ul className="mt-4 space-y-2 text-sm">
            <li>
              <Link to="/catalog" className="font-semibold hover:text-brand">
                Весь каталог
              </Link>
            </li>
            {footerCatalog.map((l) => (
              <li key={l.to}>
                <Link to={l.to} className="text-white/80 hover:text-brand">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label="Компания в подвале">
          <p className="text-xs font-semibold uppercase tracking-widest text-white/50">Компания</p>
          <ul className="mt-4 space-y-2 text-sm">
            {footerCompany.map((l) => (
              <li key={l.to}>
                <Link to={l.to} className="text-white/80 hover:text-brand">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-white/50">Бренды</p>
          <ul className="mt-4 space-y-2 text-sm text-white/80">
            {site.brands.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
          <p className="mt-8 text-xs text-white/50">
            Цены и наличие на сайте не являются публичной офертой и подтверждаются менеджером.
          </p>
        </div>
      </div>
      <div className="border-t border-white/10 py-5 text-center text-xs text-white/50">
        © {new Date().getFullYear()} {site.name}. Все права защищены.
      </div>
    </footer>
  );
}
