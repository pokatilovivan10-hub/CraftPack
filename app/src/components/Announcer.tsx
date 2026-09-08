import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

interface AnnouncerValue {
  announce: (message: string) => void;
}

const AnnouncerContext = createContext<AnnouncerValue>({ announce: () => {} });

export function useAnnouncer() {
  return useContext(AnnouncerContext);
}

/** Доступный live-region для объявления результатов действий (корзина, фильтры). */
export function AnnouncerProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const announce = useCallback((msg: string) => {
    setMessage("");
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(msg), 50);
  }, []);

  return (
    <AnnouncerContext.Provider value={{ announce }}>
      {children}
      <div aria-live="polite" role="status" className="sr-only">
        {message}
      </div>
    </AnnouncerContext.Provider>
  );
}
