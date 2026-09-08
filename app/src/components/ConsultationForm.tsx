import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { track } from "@/lib/analytics";
import { site } from "@/config/site";

interface Props {
  title?: string;
  dark?: boolean;
  context?: string;
  /** branding — показывает поля «Тип упаковки», «Тираж», «Срок» */
  variant?: "consultation" | "branding";
  /** Контекст товара — прикладывается к обращению автоматически */
  productSku?: string;
  productUrl?: string;
}

interface Draft {
  name: string;
  phone: string;
  comment: string;
  packType: string;
  runSize: string;
  deadline: string;
}

const DRAFT_KEY = "kraftpak_form_draft";

function loadDraft(): Draft {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (raw) return { name: "", phone: "", comment: "", packType: "", runSize: "", deadline: "", ...JSON.parse(raw) };
  } catch {
    /* noop */
  }
  return { name: "", phone: "", comment: "", packType: "", runSize: "", deadline: "" };
}

/**
 * Форма заявки (консультация / брендирование). Отправка — на серверный
 * обработчик requests.create: заявка сохраняется в БД, затем уведомляется
 * менеджер. При недоступном сервере введённые данные сохраняются локально
 * и предлагается повторить или позвонить — фиктивного успеха нет.
 */
export function ConsultationForm({ title = "Заказать консультацию", dark, context, variant = "consultation", productSku, productUrl }: Props) {
  const [draft] = useState<Draft>(loadDraft);
  const [name, setName] = useState(draft.name);
  const [phone, setPhone] = useState(draft.phone);
  const [comment, setComment] = useState(draft.comment);
  const [packType, setPackType] = useState(draft.packType);
  const [runSize, setRunSize] = useState(draft.runSize);
  const [deadline, setDeadline] = useState(draft.deadline);
  const [consent, setConsent] = useState(false);
  const [honeypot, setHoneypot] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "error" | "failed" | "success">("idle");
  const [error, setError] = useState("");
  const [requestNumber, setRequestNumber] = useState("");

  const createRequest = trpc.request.create.useMutation();

  const inputCls = `w-full border px-4 py-3 text-sm transition-colors focus:outline-none focus-visible:outline-2 ${
    dark
      ? "border-white/25 bg-transparent text-white placeholder:text-white/50 focus:border-brand"
      : "border-line bg-white text-ink placeholder:text-neutral-400 focus:border-ink"
  }`;

  const saveDraft = () => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ name, phone, comment, packType, runSize, deadline }));
    } catch {
      /* noop */
    }
  };

  const clearDraft = () => {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      /* noop */
    }
  };

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
      const res = await createRequest.mutateAsync({
        type: variant === "branding" ? "branding" : "consultation",
        name: name.trim(),
        phone: phone.trim(),
        comment: comment.trim() || undefined,
        packType: variant === "branding" ? packType.trim() || undefined : undefined,
        runSize: variant === "branding" ? runSize.trim() || undefined : undefined,
        deadline: variant === "branding" ? deadline.trim() || undefined : undefined,
        productSku,
        productUrl,
        pageUrl: window.location.pathname,
        consent: true,
        honeypot: honeypot || undefined,
      });
      track({ name: "consultation_submit", form: context ?? variant });
      setRequestNumber(res.number);
      setState("success");
      clearDraft();
    } catch (err) {
      saveDraft();
      setState("failed");
      setError(
        err instanceof Error && err.message && !err.message.includes("fetch")
          ? err.message
          : "Не удалось отправить заявку — сервер недоступен.",
      );
    }
  };

  if (state === "success") {
    return (
      <div className={`border p-6 ${dark ? "border-white/25" : "border-line bg-fog"}`} role="status">
        <p className="text-lg font-bold">Заявка {requestNumber} принята</p>
        <p className={`mt-2 text-sm ${dark ? "text-white/70" : "text-neutral-600"}`}>
          Менеджер свяжется с вами в рабочее время ({site.workHours}).
        </p>
      </div>
    );
  }

  const idSuffix = context ?? variant;

  return (
    <form onSubmit={submit} className="space-y-3">
      {title && <p className={`text-lg font-bold ${dark ? "text-white" : ""}`}>{title}</p>}
      <div>
        <label htmlFor={`cf-name-${idSuffix}`} className="sr-only">
          Ваше имя
        </label>
        <input
          id={`cf-name-${idSuffix}`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ваше имя"
          className={inputCls}
          required
          autoComplete="name"
        />
      </div>
      <div>
        <label htmlFor={`cf-phone-${idSuffix}`} className="sr-only">
          Телефон
        </label>
        <input
          id={`cf-phone-${idSuffix}`}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+7 (___) ___-__-__"
          type="tel"
          className={inputCls}
          required
          autoComplete="tel"
        />
      </div>
      {variant === "branding" && (
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label htmlFor={`cf-pack-${idSuffix}`} className="sr-only">
              Тип упаковки
            </label>
            <input
              id={`cf-pack-${idSuffix}`}
              value={packType}
              onChange={(e) => setPackType(e.target.value)}
              placeholder="Тип упаковки"
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor={`cf-run-${idSuffix}`} className="sr-only">
              Тираж
            </label>
            <input
              id={`cf-run-${idSuffix}`}
              value={runSize}
              onChange={(e) => setRunSize(e.target.value)}
              placeholder="Тираж"
              inputMode="numeric"
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor={`cf-deadline-${idSuffix}`} className="sr-only">
              Срок
            </label>
            <input
              id={`cf-deadline-${idSuffix}`}
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              placeholder="Срок"
              className={inputCls}
            />
          </div>
        </div>
      )}
      <div>
        <label htmlFor={`cf-comment-${idSuffix}`} className="sr-only">
          Комментарий
        </label>
        <textarea
          id={`cf-comment-${idSuffix}`}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Комментарий (необязательно)"
          rows={3}
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
      <label className={`flex items-start gap-3 text-xs ${dark ? "text-white/70" : "text-neutral-600"}`}>
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
        <div role="alert" className={`border p-4 text-sm ${dark ? "border-white/30" : "border-red-300 bg-red-50"}`}>
          <p className="font-medium text-red-700">{error}</p>
          <p className={`mt-1 ${dark ? "text-white/70" : "text-neutral-600"}`}>
            Введённые данные сохранены в этом браузере — попробуйте ещё раз или{" "}
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
        className={`${dark ? "kp-btn-primary" : "kp-btn-dark"} w-full disabled:cursor-wait disabled:opacity-60`}
      >
        {state === "sending" ? "Отправляем…" : state === "failed" ? "Повторить отправку" : "Отправить заявку"}
      </button>
    </form>
  );
}
