/** Централизованные настройки компании — единственное место правки контактов. */
export const site = {
  name: "KRAFTPAK",
  tagline: "Подарочная упаковка для вашего бизнеса",
  phone: "+7 (916) 535-73-70",
  phoneHref: "tel:+79165357370",
  email: "Xmelevo90@yandex.ru",
  address:
    "Московская область, Одинцовский городской округ, рабочий посёлок Лесной Городок, ул. Центральная, 65/1",
  workHours: "Пн–Пт, 09:00–18:00",
  brands: ["KRAFTPAK", "NOVAROLL", "UNIBOB"],
  marketplaces: ["Wildberries", "Ozon"],
} as const;

export const mainMenu = [
  { to: "/", label: "Главная" },
  { to: "/catalog", label: "Каталог" },
  { to: "/about", label: "О компании" },
  { to: "/partners", label: "Наши партнёры" },
  { to: "/contacts", label: "Контакты" },
] as const;

export const footerCatalog = [
  { to: "/catalog/pakety", label: "Пакеты" },
  { to: "/catalog/korobki", label: "Коробки" },
  { to: "/catalog/floristika", label: "Флористика" },
  { to: "/catalog/lenta", label: "Лента" },
  { to: "/catalog/novinki", label: "Новинки" },
  { to: "/catalog/produktsiya-s-logotipom", label: "Продукция с логотипом" },
] as const;

export const footerCompany = [
  { to: "/about", label: "О компании" },
  { to: "/partners", label: "Партнёры" },
  { to: "/contacts", label: "Контакты" },
  { to: "/faq", label: "Вопросы и ответы" },
  { to: "/articles", label: "Статьи" },
  { to: "/news", label: "Новости" },
  { to: "/vacancies", label: "Вакансии" },
  { to: "/requisites", label: "Реквизиты" },
  { to: "/delivery-payment", label: "Оплата и доставка" },
  { to: "/custom-logo", label: "Печать логотипа" },
  { to: "/privacy-policy", label: "Политика конфиденциальности" },
] as const;
