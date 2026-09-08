/**
 * Нейтральный слой аналитических событий.
 * Подключение реального сервиса — через window.KP_ANALYTICS_ADAPTER
 * (см. README). Персональные данные в события не передаются.
 */

export type AnalyticsEvent =
  | { name: "view_category"; categorySlug: string }
  | { name: "search"; query: string; results: number }
  | { name: "search_no_results"; query: string }
  | { name: "apply_filter"; filter: string; value: string }
  | { name: "view_product"; sku: string }
  | { name: "add_to_cart"; sku: string; quantity: number }
  | { name: "remove_from_cart"; sku: string }
  | { name: "add_to_compare"; sku: string }
  | { name: "begin_checkout"; items: number }
  | { name: "order_success"; number: string }
  | { name: "consultation_submit"; form: string };

type Adapter = (event: AnalyticsEvent) => void;

declare global {
  interface Window {
    KP_ANALYTICS_ADAPTER?: Adapter;
  }
}

export function track(event: AnalyticsEvent): void {
  try {
    window.KP_ANALYTICS_ADAPTER?.(event);
    if (import.meta.env.DEV) console.debug("[analytics]", event);
  } catch {
    // аналитика не должна ломать UX
  }
}
