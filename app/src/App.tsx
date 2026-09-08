import { useEffect, useRef } from "react";
import { Routes, Route, useLocation, useNavigationType, Navigate } from "react-router";
import { CartProvider } from "@/store/cart";
import { CompareProvider } from "@/store/compare";
import { AnnouncerProvider } from "@/components/Announcer";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import Home from "@/pages/Home";
import Catalog from "@/pages/Catalog";
import Category from "@/pages/Category";
import Product from "@/pages/Product";
import SearchPage from "@/pages/SearchPage";
import Compare from "@/pages/Compare";
import Cart from "@/pages/Cart";
import Checkout from "@/pages/Checkout";
import OrderSuccess from "@/pages/OrderSuccess";
import About from "@/pages/About";
import Contacts from "@/pages/Contacts";
import Partners from "@/pages/Partners";
import CustomLogo from "@/pages/CustomLogo";
import InfoPage from "@/pages/InfoPage";
import AdminImport from "@/pages/AdminImport";
import NotFound from "@/pages/NotFound";

/**
 * Управление прокруткой:
 * — при переходе вперёд (PUSH) — наверх;
 * — при возврате назад/вперёд (POP) — восстановление сохранённой позиции;
 * — позиции хранятся в sessionStorage по ключу history-записи.
 */
function ScrollManager() {
  const location = useLocation();
  const navType = useNavigationType();
  const suppressUntil = useRef(0);

  // Браузерную нативную реставрацию отключаем — позицией управляем сами
  useEffect(() => {
    if ("scrollRestoration" in history) {
      history.scrollRestoration = "manual";
    }
  }, []);

  useEffect(() => {
    let raf = 0;
    const save = () => {
      if (Date.now() < suppressUntil.current) return;
      try {
        sessionStorage.setItem(`kp-scroll:${location.key}`, String(window.scrollY));
      } catch {
        /* noop */
      }
    };
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(save);
    };
    // При клике по внутренней ссылке сохраняем позицию синхронно — до того,
    // как смена контента «сплющит» документ и браузер урежет scrollY
    const onClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement | null)?.closest?.("a[href^='/']");
      if (!anchor) return;
      suppressUntil.current = 0;
      save();
      suppressUntil.current = Date.now() + 1500;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("click", onClick, true);
      cancelAnimationFrame(raf);
      save();
    };
  }, [location.key]);

  useEffect(() => {
    if (navType === "POP") {
      let saved = 0;
      try {
        saved = Number(sessionStorage.getItem(`kp-scroll:${location.key}`) ?? 0);
      } catch {
        /* noop */
      }
      if (saved > 0) {
        // Контент подгружается асинхронно — пробуем восстановить несколько раз,
        // пока документ не набрал высоту; на время реставрации сохранение
        // приостанавливаем, чтобы обрезанные значения не затёрли сохранённое
        suppressUntil.current = Date.now() + 2800;
        const timers = [0, 150, 400, 900, 1600, 2500].map((ms) =>
          setTimeout(() => window.scrollTo({ top: saved, behavior: "instant" as ScrollBehavior }), ms),
        );
        return () => timers.forEach(clearTimeout);
      }
    }
    if (!location.hash) {
      window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key, navType]);

  return null;
}

export default function App() {
  return (
    <AnnouncerProvider>
      <CartProvider>
        <CompareProvider>
          <ScrollManager />
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[80] focus:bg-brand focus:px-4 focus:py-2 focus:font-bold"
          >
            Перейти к содержимому
          </a>
          <Header />
          <main id="main">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/catalog" element={<Catalog />} />
              {/* Миграция: старый раздел «Новинка» → канонический «Новинки» */}
              <Route path="/catalog/novinka" element={<Navigate to="/catalog/novinki" replace />} />
              <Route path="/catalog/*" element={<Category />} />
              <Route path="/product/:slug" element={<Product />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/compare" element={<Compare />} />
              <Route path="/cart" element={<Cart />} />
              <Route path="/checkout" element={<Checkout />} />
              <Route path="/checkout/success" element={<OrderSuccess />} />
              <Route path="/about" element={<About />} />
              <Route path="/partners" element={<Partners />} />
              <Route path="/contacts" element={<Contacts />} />
              <Route path="/custom-logo" element={<CustomLogo />} />
              <Route
                path="/brands"
                element={
                  <InfoPage
                    slug="brands"
                    title="Бренды"
                    seoDescription="Бренды KRAFTPAK, NOVAROLL, UNIBOB."
                    fallback={`Собственные бренды компании: KRAFTPAK, NOVAROLL, UNIBOB.`}
                  />
                }
              />
              <Route
                path="/faq"
                element={
                  <InfoPage
                    slug="faq"
                    title="Вопросы и ответы"
                    seoDescription="Ответы на частые вопросы о заказе упаковки."
                    emptyState="Ответы на частые вопросы скоро появятся. Задайте вопрос через форму на странице контактов."
                  />
                }
              />
              <Route
                path="/news"
                element={
                  <InfoPage
                    slug="news"
                    title="Новости"
                    seoDescription="Новости KRAFTPAK."
                    emptyState="Новостей пока нет — раздел наполняется."
                  />
                }
              />
              <Route
                path="/news/:slug"
                element={
                  <InfoPage slug="news" title="Новости" seoDescription="Новости KRAFTPAK." emptyState="Публикация не найдена." />
                }
              />
              <Route
                path="/articles"
                element={
                  <InfoPage
                    slug="articles"
                    title="Статьи"
                    seoDescription="Статьи об упаковке от KRAFTPAK."
                    emptyState="Статей пока нет — раздел наполняется."
                  />
                }
              />
              <Route
                path="/articles/:slug"
                element={
                  <InfoPage slug="articles" title="Статьи" seoDescription="Статьи KRAFTPAK." emptyState="Публикация не найдена." />
                }
              />
              <Route
                path="/vacancies"
                element={
                  <InfoPage
                    slug="vacancies"
                    title="Вакансии"
                    seoDescription="Вакансии KRAFTPAK."
                    emptyState="Открытых вакансий сейчас нет."
                  />
                }
              />
              <Route
                path="/requisites"
                element={
                  <InfoPage slug="requisites" title="Реквизиты" seoDescription="Реквизиты KRAFTPAK." />
                }
              />
              <Route
                path="/privacy-policy"
                element={
                  <InfoPage
                    slug="privacy-policy"
                    title="Политика конфиденциальности"
                    seoDescription="Политика обработки персональных данных KRAFTPAK."
                  />
                }
              />
              <Route
                path="/delivery-payment"
                element={
                  <InfoPage
                    slug="delivery-payment"
                    title="Оплата и доставка"
                    seoDescription="Условия оплаты и доставки KRAFTPAK."
                  />
                }
              />
              <Route path="/admin/catalog-import" element={<AdminImport />} />
              <Route path="/404" element={<NotFound />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </main>
          <Footer />
        </CompareProvider>
      </CartProvider>
    </AnnouncerProvider>
  );
}
