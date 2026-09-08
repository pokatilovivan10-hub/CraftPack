import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { track } from "@/lib/analytics";

export interface CartLine {
  sku: string;
  title: string;
  price: string | null;
  image: string | null;
  quantity: number;
}

interface CartContextValue {
  lines: CartLine[];
  count: number;
  total: string;
  add: (line: Omit<CartLine, "quantity">, quantity?: number) => void;
  setQuantity: (sku: string, quantity: number) => void;
  remove: (sku: string) => void;
  clear: () => void;
  lastAddedAt: number;
}

const CartContext = createContext<CartContextValue | null>(null);
const KEY = "kraftpak_cart_v1";

function load(): CartLine[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (l) => l && typeof l.sku === "string" && Number.isInteger(l.quantity) && l.quantity > 0,
    );
  } catch {
    return [];
  }
}

/** Итог в целых копейках, без float. */
function totalOf(lines: CartLine[]): string {
  let cents = 0n;
  for (const l of lines) {
    if (l.price === null) continue;
    const [i, f = ""] = l.price.split(".");
    cents += (BigInt(i) * 100n + BigInt((f + "00").slice(0, 2))) * BigInt(l.quantity);
  }
  return `${cents / 100n}.${(cents % 100n).toString().padStart(2, "0")}`;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>(() => load());
  const [lastAddedAt, setLastAddedAt] = useState(0);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(lines));
    } catch {
      // переполнение localStorage не должно ломать UX
    }
  }, [lines]);

  const value = useMemo<CartContextValue>(
    () => ({
      lines,
      count: lines.reduce((s, l) => s + l.quantity, 0),
      total: totalOf(lines),
      lastAddedAt,
      add: (line, quantity = 1) => {
        setLines((prev) => {
          // Объединение одинаковых SKU без дублей строк
          const idx = prev.findIndex((l) => l.sku === line.sku);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = { ...next[idx], quantity: next[idx].quantity + quantity };
            return next;
          }
          return [...prev, { ...line, quantity }];
        });
        setLastAddedAt(Date.now());
        track({ name: "add_to_cart", sku: line.sku, quantity });
      },
      setQuantity: (sku, quantity) => {
        setLines((prev) =>
          quantity <= 0
            ? prev.filter((l) => l.sku !== sku)
            : prev.map((l) => (l.sku === sku ? { ...l, quantity } : l)),
        );
      },
      remove: (sku) => {
        setLines((prev) => prev.filter((l) => l.sku !== sku));
        track({ name: "remove_from_cart", sku });
      },
      clear: () => setLines([]),
    }),
    [lines, lastAddedAt],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart вне CartProvider");
  return ctx;
}
