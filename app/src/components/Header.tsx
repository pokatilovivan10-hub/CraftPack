import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router";
import { Search, GitCompareArrows, ShoppingCart, Menu, X, Phone } from "lucide-react";
import { mainMenu, site } from "@/config/site";
import { useCart } from "@/store/cart";
import { useCompare } from "@/store/compare";
import { trpc } from "@/providers/trpc";
import { formatPrice, imageUrl, productsCount } from "@/lib/format";
import { CallbackModal } from "@/components/CallbackModal";

export function Header() {
  const cart = useCart();
  const compare = useCompare();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [callbackOpen, setCallbackOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-white">
      <div className="kp-container">
        <div className={`flex items-center gap-2 transition-all duration-300 sm:gap-4 ${scrolled ? "h-14" : "h-[72px]"}`}>
          <button
            type="button"
            className="flex h-11 w-11 items-center justify-center border border-line xl:hidden"
            aria-label="Открыть меню"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-5 w-5" aria-hidden />
          </button>

          <Link to="/" className="flex items-baseline gap-2" aria-label="KRAFTPAK — на главную">
            <span className="text-xl font-extrabold tracking-tight sm:text-2xl">
              KRAFT<span className="bg-brand px-1">PAK</span>
            </span>
          </Link>

          <nav aria-label="Основное меню" className="hidden items-center gap-1 xl:flex">
            {mainMenu.map((item) =>
              item.to === "/catalog" ? (
                <div
                  key={item.to}
                  className="relative"
                  onMouseEnter={() => setCatalogOpen(true)}
                  onMouseLeave={() => setCatalogOpen(false)}
                >
                  <NavLink
                    to={item.to}
                    className={({ isActive }) =>
                      `px-3 py-2 text-sm font-medium uppercase tracking-wide transition-colors hover:bg-fog ${
                        isActive ? "bg-ink text-white hover:bg-ink" : ""
                      }`
                    }
                    onFocus={() => setCatalogOpen(true)}
                    aria-expanded={catalogOpen}
                    aria-haspopup="true"
                  >
                    {item.label}
                  </NavLink>
                  {catalogOpen && <MegaMenu onClose={() => setCatalogOpen(false)} />}
                </div>
              ) : (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `px-3 py-2 text-sm font-medium uppercase tracking-wide transition-colors hover:bg-fog ${
                      isActive ? "bg-ink text-white hover:bg-ink" : ""
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ),
            )}
          </nav>

          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <SearchBox />
            <Link
              to="/compare"
              className="relative flex h-11 w-11 items-center justify-center border border-line transition-colors hover:bg-fog"
              aria-label={`Сравнение товаров, ${compare.skus.length}`}
            >
              <GitCompareArrows className="h-5 w-5" aria-hidden />
              {compare.skus.length > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center bg-ink px-1 text-[11px] font-bold text-white">
                  {compare.skus.length}
                </span>
              )}
            </Link>
            <Link
              to="/cart"
              className="relative flex h-11 min-w-11 items-center justify-center gap-2 border border-line px-2 transition-colors hover:bg-fog"
              aria-label={`Корзина, ${productsCount(cart.count)}`}
            >
              <ShoppingCart className="h-5 w-5" aria-hidden />
              {cart.count > 0 && (
                <>
                  <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center bg-brand px-1 text-[11px] font-bold text-ink">
                    {cart.count}
                  </span>
                  <span className="hidden text-sm font-semibold 2xl:inline">{formatPrice(cart.total)}</span>
                </>
              )}
            </Link>
            <a
              href={site.phoneHref}
              className="hidden h-11 items-center gap-2 border border-line px-3 text-sm font-semibold transition-colors hover:bg-fog md:inline-flex"
              aria-label={`Позвонить: ${site.phone}`}
            >
              <Phone className="h-4 w-4" aria-hidden />
              <span className="hidden 2xl:inline">Позвонить</span>
            </a>
            <button
              type="button"
              className="kp-btn-primary hidden !min-h-11 md:inline-flex"
              onClick={() => setCallbackOpen(true)}
              aria-haspopup="dialog"
            >
              Заказать звонок
            </button>
          </div>
        </div>
      </div>

      {mobileOpen && <MobileMenu onClose={() => setMobileOpen(false)} onCallback={() => setCallbackOpen(true)} />}
      {callbackOpen && <CallbackModal onClose={() => setCallbackOpen(false)} />}
    </header>
  );
}

/** Mega-menu каталога: верхний уровень + один уровень детей активного раздела. */
function MegaMenu({ onClose }: { onClose: () => void }) {
  const { data } = trpc.catalog.categories.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const active = data?.find((c) => c.slug === activeSlug);

  return (
    <div
      className="absolute left-0 top-full z-50 w-[640px] border border-line bg-white shadow-xl"
      role="menu"
      onMouseLeave={onClose}
    >
      <div className="grid grid-cols-2 gap-0">
        <ul className="max-h-[70vh] overflow-y-auto border-r border-line py-2">
          {data?.map((c) => (
            <li key={c.id}>
              <Link
                to={`/catalog/${c.slug}`}
                role="menuitem"
                className={`flex items-center justify-between px-4 py-2 text-sm transition-colors hover:bg-fog ${
                  activeSlug === c.slug ? "bg-fog font-semibold" : ""
                }`}
                onMouseEnter={() => setActiveSlug(c.slug)}
                onFocus={() => setActiveSlug(c.slug)}
                onClick={onClose}
              >
                <span>{c.name}</span>
                {c.productCount > 0 && (
                  <span className="text-xs text-neutral-500">{c.productCount}</span>
                )}
              </Link>
            </li>
          ))}
        </ul>
        <div className="bg-fog p-4">
          {active && active.children.length > 0 ? (
            <ul className="space-y-1">
              {active.children.map((ch) => (
                <li key={ch.id}>
                  <Link
                    to={`/catalog/${ch.slug}`}
                    role="menuitem"
                    className="block px-2 py-1.5 text-sm hover:bg-white"
                    onClick={onClose}
                  >
                    {ch.name}
                    <span className="ml-2 text-xs text-neutral-500">{ch.productCount}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-2 py-1.5 text-sm text-neutral-500">
              Выберите раздел — подкатегории появятся здесь.
            </p>
          )}
          <Link
            to="/catalog"
            className="mt-4 inline-block bg-ink px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white"
            onClick={onClose}
          >
            Весь каталог
          </Link>
        </div>
      </div>
    </div>
  );
}

/** Поиск с серверными подсказками после 2 символов, debounce 250мс. */
function SearchBox() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const navigate = useNavigate();
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  const { data: suggestions, isFetching } = trpc.search.suggest.useQuery(
    { q: debounced },
    { enabled: debounced.length >= 2, staleTime: 30_000 },
  );

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!q.trim()) return;
    setOpen(false);
    navigate(`/search?q=${encodeURIComponent(q.trim())}`);
    try {
      const key = "kraftpak_recent_searches";
      const prev: string[] = JSON.parse(localStorage.getItem(key) ?? "[]");
      const next = [q.trim(), ...prev.filter((x) => x !== q.trim())].slice(0, 8);
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      /* noop */
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        className="flex h-11 w-11 items-center justify-center border border-line transition-colors hover:bg-fog"
        aria-label="Открыть поиск"
        onClick={() => setOpen(true)}
      >
        <Search className="h-5 w-5" aria-hidden />
      </button>
    );
  }

  return (
    <div ref={boxRef} className="relative">
      <form onSubmit={submit} role="search" className="flex items-center">
        <label htmlFor="header-search" className="sr-only">
          Поиск по каталогу
        </label>
        <input
          id="header-search"
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Название или артикул…"
          className="h-11 w-[42vw] max-w-md border border-line px-3 text-sm focus:border-ink sm:w-[300px]"
          autoComplete="off"
          onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
        />
        <button type="submit" className="kp-btn-dark !min-h-11 !px-4" aria-label="Найти">
          <Search className="h-4 w-4" aria-hidden />
        </button>
        <button
          type="button"
          className="flex h-11 w-11 items-center justify-center border border-l-0 border-line"
          aria-label="Закрыть поиск"
          onClick={() => setOpen(false)}
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </form>
      {debounced.length >= 2 && (
        <div className="absolute right-0 top-full z-50 mt-1 w-[320px] border border-line bg-white shadow-lg sm:w-[420px]">
          {isFetching && <p className="px-4 py-3 text-sm text-neutral-500">Поиск…</p>}
          {!isFetching && suggestions?.length === 0 && (
            <p className="px-4 py-3 text-sm text-neutral-500">Ничего не найдено</p>
          )}
          <ul>
            {suggestions?.map((p) => (
              <li key={p.sku}>
                <Link
                  to={`/product/${p.slug}`}
                  className="flex items-center gap-3 px-3 py-2 hover:bg-fog"
                  onClick={() => setOpen(false)}
                >
                  {p.image ? (
                    <img
                      src={imageUrl(p.image.storageKey) ?? ""}
                      alt=""
                      width={36}
                      height={36}
                      className="h-9 w-9 border border-line object-contain"
                      loading="lazy"
                    />
                  ) : (
                    <span className="h-9 w-9 border border-line bg-fog" aria-hidden />
                  )}
                  <span className="min-w-0 flex-1 truncate text-sm">{p.title}</span>
                  <span className="whitespace-nowrap text-sm font-semibold">{formatPrice(p.price)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Мобильное меню: полноэкранное, focus-trap, Escape, блокировка прокрутки. */
function MobileMenu({ onClose, onCallback }: { onClose: () => void; onCallback: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const { data } = trpc.catalog.categories.useQuery(undefined, { staleTime: 5 * 60 * 1000 });

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const prevActive = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>("button, a")?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab" && ref.current) {
        const focusables = ref.current.querySelectorAll<HTMLElement>("a[href], button");
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
      prevActive?.focus();
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-label="Меню"
      className="fixed inset-0 z-[60] flex flex-col bg-ink text-white xl:hidden"
    >
      <div className="flex h-16 items-center justify-between border-b border-white/15 px-4">
        <span className="text-xl font-extrabold">
          KRAFT<span className="bg-brand px-1 text-ink">PAK</span>
        </span>
        <button
          type="button"
          className="flex h-11 w-11 items-center justify-center border border-white/25"
          aria-label="Закрыть меню"
          onClick={onClose}
        >
          <X className="h-5 w-5" aria-hidden />
        </button>
      </div>
      <nav aria-label="Мобильное меню" className="flex-1 overflow-y-auto px-4 py-6">
        <ul className="space-y-1">
          {mainMenu.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                onClick={onClose}
                className="block py-3 text-2xl font-bold uppercase tracking-wide hover:text-brand"
              >
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
        <p className="mt-8 text-xs uppercase tracking-widest text-white/50">Каталог</p>
        <ul className="mt-2 space-y-1">
          {data?.map((c) => (
            <li key={c.id}>
              <NavLink
                to={`/catalog/${c.slug}`}
                onClick={onClose}
                className="flex items-baseline justify-between py-1.5 text-lg hover:text-brand"
              >
                <span>{c.name}</span>
                {c.productCount > 0 && (
                  <span className="text-xs text-white/50">{productsCount(c.productCount)}</span>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <div className="border-t border-white/15 p-4 text-sm">
        <button
          type="button"
          className="kp-btn-primary w-full"
          onClick={() => {
            onClose();
            onCallback();
          }}
        >
          Заказать звонок
        </button>
        <a href={site.phoneHref} className="mt-3 block py-1 font-semibold text-brand">
          Позвонить: {site.phone}
        </a>
        <a href={`mailto:${site.email}`} className="block py-1 text-white/80">
          {site.email}
        </a>
      </div>
    </div>
  );
}
