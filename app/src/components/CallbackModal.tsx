import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { track } from "@/lib/analytics";
import { site } from "@/config/site";

interface Props {
  onClose: () => void;
}

/**
 * Доступное модальное окно «Заказать звонок»: имя, телефон,
 * необязательное удобное время, согласие. Отправка — на тот же
 * серверный обработчик заявок; при недоступном сервере данные
 * сохраняются локально и предлагается повторить или позвонить.
 */
export function CallbackModal({ onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [time, setTime] = useState("");
  const [consent, setConsent] = useState(false);
  const [honeypot, setHoneypot] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "error" | "failed" | "success">("idle");
  const [error, setError] = useState("");
  const createRequest = trpc.request.create.useMutation();

  // Focus trap + Escape + блокировка прокрутки + возврат фокуса
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const prevActive = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>("input")?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab" && ref.current) {
        const focusables = ref.current.querySelectorAll<HTMLElement>(
          "input:not([tabindex='-1']), button, a[href]",
        );
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

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (name.trim().length < 2) {
      setState("error");
      setError("Укажите имя.");
      return;
    }
    if (!/^[+()\- 0-9]{10,20}$/.test(phone.trim())) {
      setState("error");
      setError("Укажите корректный телефон.");
      return;
    }
    if (!consent) {
      setState("error");
      setError("Требуется согласие на обработку персональных данных.");
      return;
    }
    setState("sending");
    try {
      await createRequest.mutateAsync({
        type: "callback",
        name: name.trim(),
        phone: phone.trim(),
        preferredTime: time.trim() || undefined,
        pageUrl: window.location.pathname,
        consent: true,
        honeypot: honeypot || undefined,
      });
      track({ name: "consultation_submit", form: "callback" });
      setState("success");
    } catch (err) {
      try {
        localStorage.setItem("kraftpak_callback_draft", JSON.stringify({ name, phone, time }));
      } catch {
        /* noop */
      }
      setState("failed");
      setError(err instanceof Error && err.message ? err.message : "Сервер недоступен.");
    }
  };

  const inputCls =
    "w-full border border-line bg-white px-4 py-3 text-sm text-ink placeholder:text-neutral-400 focus:border-ink focus:outline-none focus-visible:outline-2";

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-ink/70 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="callback-h"
        className="w-full max-w-md bg-white p-6 shadow-2xl md:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id="callback-h" className="text-xl font-extrabold">
            Заказать звонок
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="flex h-11 w-11 shrink-0 items-center justify-center border border-line hover:bg-fog"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        {state === "success" ? (
          <div role="status" className="mt-6">
            <p className="font-bold">Заявка принята</p>
            <p className="mt-2 text-sm text-neutral-600">
              Перезвоним в рабочее время ({site.workHours}).
            </p>
            <button type="button" onClick={onClose} className="kp-btn-dark mt-6 w-full">
              Закрыть
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-3">
            <div>
              <label htmlFor="cb-name" className="mb-1 block text-xs font-semibold uppercase tracking-widest text-neutral-500">
                Имя
              </label>
              <input
                id="cb-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputCls}
                required
                autoComplete="name"
              />
            </div>
            <div>
              <label htmlFor="cb-phone" className="mb-1 block text-xs font-semibold uppercase tracking-widest text-neutral-500">
                Телефон
              </label>
              <input
                id="cb-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                type="tel"
                placeholder="+7 (___) ___-__-__"
                className={inputCls}
                required
                autoComplete="tel"
              />
            </div>
            <div>
              <label htmlFor="cb-time" className="mb-1 block text-xs font-semibold uppercase tracking-widest text-neutral-500">
                Удобное время <span className="font-normal normal-case text-neutral-400">(необязательно)</span>
              </label>
              <input
                id="cb-time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                placeholder="Например, завтра после 14:00"
                className={inputCls}
              />
            </div>
            {/* Honeypot: визуально скрыто, вне tab-порядка и дерева доступности */}
            <div aria-hidden="true" className="absolute left-0 top-0 h-px w-px overflow-hidden opacity-0">
              <input
                type="text"
                value={honeypot}
                onChange={(e) => setHoneypot(e.target.value)}
                tabIndex={-1}
                autoComplete="off"
                name="website"
              />
            </div>
            <label className="flex items-start gap-3 text-xs text-neutral-600">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-[#0D1115]"
              />
              <span>
                Соглашаюсь с{" "}
                <a href="/privacy-policy" className="underline">
                  политикой обработки персональных данных
                </a>
              </span>
            </label>
            {state === "error" && (
              <p role="alert" className="text-sm font-medium text-red-700">
                {error}
              </p>
            )}
            {state === "failed" && (
              <div role="alert" className="border border-red-300 bg-red-50 p-4 text-sm">
                <p className="font-medium text-red-700">Не удалось отправить: {error}</p>
                <p className="mt-1 text-neutral-600">
                  Данные сохранены в браузере — повторите отправку или{" "}
                  <a href={site.phoneHref} className="font-semibold underline">
                    позвоните нам
                  </a>
                  .
                </p>
              </div>
            )}
            <button
              type="submit"
              disabled={state === "sending"}
              className="kp-btn-primary w-full disabled:cursor-wait disabled:opacity-60"
            >
              {state === "sending" ? "Отправляем…" : state === "failed" ? "Повторить отправку" : "Жду звонка"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
