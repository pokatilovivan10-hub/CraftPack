import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { track } from "@/lib/analytics";

export const COMPARE_LIMIT = 4;

interface CompareContextValue {
  skus: string[];
  toggle: (sku: string) => "added" | "removed" | "limit";
  has: (sku: string) => boolean;
  remove: (sku: string) => void;
  clear: () => void;
}

const CompareContext = createContext<CompareContextValue | null>(null);
const KEY = "kraftpak_compare_v1";

function load(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((s) => typeof s === "string").slice(0, COMPARE_LIMIT) : [];
  } catch {
    return [];
  }
}

export function CompareProvider({ children }: { children: ReactNode }) {
  const [skus, setSkus] = useState<string[]>(() => load());
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(skus));
    } catch {
      /* noop */
    }
  }, [skus]);

  const value = useMemo<CompareContextValue>(
    () => ({
      skus,
      has: (sku) => skus.includes(sku),
      toggle: (sku) => {
        if (skus.includes(sku)) {
          setSkus(skus.filter((s) => s !== sku));
          return "removed";
        }
        if (skus.length >= COMPARE_LIMIT) return "limit";
        setSkus([...skus, sku]);
        track({ name: "add_to_compare", sku });
        return "added";
      },
      remove: (sku) => setSkus(skus.filter((s) => s !== sku)),
      clear: () => setSkus([]),
    }),
    [skus],
  );

  return <CompareContext.Provider value={value}>{children}</CompareContext.Provider>;
}

export function useCompare(): CompareContextValue {
  const ctx = useContext(CompareContext);
  if (!ctx) throw new Error("useCompare вне CompareProvider");
  return ctx;
}
