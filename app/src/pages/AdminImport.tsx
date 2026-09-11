import { useRef, useState } from "react";
import { trpc } from "@/providers/trpc";
import { Seo } from "@/lib/Seo";
import { formatDateRu } from "@/lib/format";

const TOKEN_KEY = "kraftpak_admin_token";
const SITES_RUNTIME = import.meta.env.VITE_SITES_RUNTIME === "true";

export default function AdminImport() {
  const [token, setToken] = useState(() =>
    SITES_RUNTIME ? "sites-owner" : sessionStorage.getItem(TOKEN_KEY) ?? "",
  );
  const [authed, setAuthed] = useState(false);
  const [loginError, setLoginError] = useState("");
  const login = trpc.admin.login.useMutation();

  const submitLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    try {
      await login.mutateAsync({ token });
      sessionStorage.setItem(TOKEN_KEY, token);
      setAuthed(true);
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : "Ошибка входа");
    }
  };

  if (!authed) {
    return (
      <div className="kp-container flex justify-center py-24">
        <Seo title="Администрирование" noindex />
        <form onSubmit={submitLogin} className="w-full max-w-sm border border-line p-8">
          <h1 className="text-xl font-bold">Импорт каталога</h1>
          {SITES_RUNTIME ? (
            <>
              <p className="mt-2 text-sm text-neutral-600">
                Раздел доступен владельцу сайта после безопасного входа через ChatGPT.
              </p>
              <a href="/signin-with-chatgpt" className="kp-btn-outline mt-6 w-full text-center">
                Войти через ChatGPT
              </a>
            </>
          ) : (
            <>
              <p className="mt-2 text-sm text-neutral-600">
                Раздел доступен администратору. Введите токен доступа.
              </p>
              <label htmlFor="adm-token" className="mt-6 block text-sm font-medium">
                Токен
              </label>
              <input
                id="adm-token"
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="mt-1 h-12 w-full border border-line px-4 focus:border-ink"
                autoComplete="current-password"
              />
            </>
          )}
          {loginError && (
            <p role="alert" className="mt-2 text-sm font-medium text-red-700">
              {loginError}
            </p>
          )}
          <button type="submit" className="kp-btn-dark mt-6 w-full" disabled={login.isPending}>
            {SITES_RUNTIME ? "Проверить доступ" : "Войти"}
          </button>
        </form>
      </div>
    );
  }

  return <AdminPanel token={token} />;
}

function AdminPanel({ token }: { token: string }) {
  const [mode, setMode] = useState<"dry_run" | "apply">("dry_run");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const importMutation = trpc.admin.importCatalog.useMutation();
  const [result, setResult] = useState<Awaited<ReturnType<typeof importMutation.mutateAsync>> | null>(null);
  const batches = trpc.admin.batches.useQuery({ token }, { refetchInterval: 30_000 });
  const requests = trpc.admin.requests.useQuery({ token }, { refetchInterval: 30_000 });
  const orders = trpc.admin.orders.useQuery({ token }, { refetchInterval: 30_000 });
  const mappings = trpc.admin.mappings.useQuery({ token });
  const utils = trpc.useUtils();

  async function run() {
    if (!file) return;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const buffer = await file.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(buffer).reduce((s, b) => s + String.fromCharCode(b), ""),
      );
      const res = await importMutation.mutateAsync({
        token,
        fileName: file.name,
        fileBase64: base64,
        mode,
      });
      setResult(res);
      utils.admin.batches.invalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка импорта");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="kp-container py-10">
      <Seo title="Импорт каталога" noindex />
      <h1 className="kp-h2">Импорт каталога из XLSX</h1>
      <p className="mt-2 max-w-2xl text-sm text-neutral-600">
        Сначала запустите предварительную проверку (dry-run) — она не меняет базу.
        Затем примените импорт. Повторная загрузка идентичного файла дублей не создаёт.
      </p>

      <div className="mt-8 grid gap-8 xl:grid-cols-2">
        <section aria-labelledby="requests-h">
          <h2 id="requests-h" className="text-lg font-bold">Последние заявки</h2>
          <div className="mt-3 overflow-x-auto border border-line">
            <table className="w-full min-w-[680px] text-sm">
              <thead className="bg-fog text-left text-xs uppercase tracking-wide">
                <tr><th className="p-3">Номер</th><th className="p-3">Дата</th><th className="p-3">Тип</th><th className="p-3">Клиент</th><th className="p-3">Телефон</th><th className="p-3">Комментарий</th></tr>
              </thead>
              <tbody>
                {requests.data?.map((item) => (
                  <tr key={item.id} className="border-t border-line align-top">
                    <td className="p-3 font-semibold">{item.number}</td>
                    <td className="p-3 whitespace-nowrap">{formatDateRu(item.createdAt)}</td>
                    <td className="p-3">{item.type}</td>
                    <td className="p-3">{item.name}</td>
                    <td className="p-3 whitespace-nowrap"><a className="underline" href={`tel:${item.phone}`}>{item.phone}</a></td>
                    <td className="max-w-64 p-3">{item.comment || item.preferredTime || "—"}</td>
                  </tr>
                ))}
                {requests.data?.length === 0 && <tr><td className="p-4 text-neutral-500" colSpan={6}>Заявок пока нет.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <section aria-labelledby="orders-h">
          <h2 id="orders-h" className="text-lg font-bold">Последние заказы</h2>
          <div className="mt-3 overflow-x-auto border border-line">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-fog text-left text-xs uppercase tracking-wide">
                <tr><th className="p-3">Номер</th><th className="p-3">Дата</th><th className="p-3">Клиент</th><th className="p-3">Контакты</th><th className="p-3">Позиций</th><th className="p-3">Сумма</th></tr>
              </thead>
              <tbody>
                {orders.data?.map((item) => (
                  <tr key={item.id} className="border-t border-line align-top">
                    <td className="p-3 font-semibold">{item.number}</td>
                    <td className="p-3 whitespace-nowrap">{formatDateRu(item.createdAt)}</td>
                    <td className="p-3">{item.customerName}{item.company ? <span className="block text-xs text-neutral-500">{item.company}</span> : null}</td>
                    <td className="p-3"><a className="underline" href={`tel:${item.phone}`}>{item.phone}</a><a className="block underline" href={`mailto:${item.email}`}>{item.email}</a></td>
                    <td className="p-3">{item.itemsCount}</td>
                    <td className="p-3 whitespace-nowrap">{item.total} ₽</td>
                  </tr>
                ))}
                {orders.data?.length === 0 && <tr><td className="p-4 text-neutral-500" colSpan={6}>Заказов пока нет.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <div className="mt-8 grid gap-10 lg:grid-cols-2">
        <section className="border border-line p-6" aria-labelledby="imp-h">
          <h2 id="imp-h" className="text-lg font-bold">Новый импорт</h2>

          <fieldset className="mt-4">
            <legend className="text-sm font-medium">Режим</legend>
            <div className="mt-2 flex gap-4">
              {(
                [
                  ["dry_run", "Предварительная проверка"],
                  ["apply", "Применить импорт"],
                ] as const
              ).map(([v, l]) => (
                <label key={v} className="flex min-h-[44px] items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="mode"
                    checked={mode === v}
                    onChange={() => setMode(v)}
                    className="h-4 w-4 accent-[#0D1115]"
                  />
                  {l}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="mt-4">
            <label htmlFor="imp-file" className="block text-sm font-medium">
              Файл прайс-листа (.xlsx)
            </label>
            <input
              id="imp-file"
              ref={fileRef}
              type="file"
              accept=".xlsx,.csv"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="mt-2 block w-full text-sm file:mr-4 file:border file:border-line file:bg-white file:px-4 file:py-2.5 file:text-sm file:font-semibold hover:file:bg-fog"
            />
          </div>

          <button
            type="button"
            onClick={run}
            disabled={!file || busy}
            className="kp-btn-primary mt-6 disabled:opacity-50"
          >
            {busy ? "Обработка…" : mode === "dry_run" ? "Проверить (dry-run)" : "Применить импорт"}
          </button>

          {error && (
            <p role="alert" className="mt-4 border border-red-600 bg-red-50 p-3 text-sm font-medium text-red-700">
              {error}
            </p>
          )}

          {result && (
            <div className="mt-6 border border-line p-4 text-sm" role="status">
              <p className="font-bold">
                Партия #{result.batchId}:{" "}
                {result.status === "success" ? "успешно" : result.status === "partial" ? "с предупреждениями" : "ошибка"}
              </p>
              <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                <div><dt className="text-neutral-500">Строк</dt><dd className="font-bold">{result.totalRows}</dd></div>
                <div><dt className="text-neutral-500">Создано</dt><dd className="font-bold">{result.created}</dd></div>
                <div><dt className="text-neutral-500">Обновлено</dt><dd className="font-bold">{result.updated}</dd></div>
                <div><dt className="text-neutral-500">Без изменений</dt><dd className="font-bold">{result.unchanged}</dd></div>
                <div><dt className="text-neutral-500">Предупреждения</dt><dd className="font-bold">{result.warnings}</dd></div>
                <div><dt className="text-neutral-500">Ошибки</dt><dd className="font-bold">{result.errors}</dd></div>
              </dl>
              {result.priceDate && (
                <p className="mt-2 text-neutral-600">Дата прайса: {result.priceDate}</p>
              )}
              {Object.keys(result.sections ?? {}).length > 0 && (
                <ul className="mt-2 text-neutral-600">
                  {Object.entries(result.sections).map(([s, n]) => (
                    <li key={s}>«{s}» — {n} товаров</li>
                  ))}
                </ul>
              )}
              {result.issues.length > 0 && (
                <details className="mt-3">
                  <summary className="cursor-pointer font-semibold">Проблемы ({result.issues.length})</summary>
                  <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto text-xs">
                    {result.issues.map((i, idx) => (
                      <li key={idx} className={i.severity === "error" ? "text-red-700" : "text-amber-700"}>
                        [{i.severity === "error" ? "ошибка" : "предупреждение"}]
                        {i.rowNumber ? ` строка ${i.rowNumber}:` : ""} {i.message}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}
        </section>

        <section aria-labelledby="hist-h">
          <h2 id="hist-h" className="text-lg font-bold">История импортов</h2>
          <div className="mt-4 overflow-x-auto border border-line">
            <table className="w-full text-sm">
              <thead className="bg-fog text-left text-xs uppercase tracking-wide">
                <tr>
                  <th className="p-3">#</th>
                  <th className="p-3">Дата</th>
                  <th className="p-3">Файл</th>
                  <th className="p-3">Режим</th>
                  <th className="p-3">Статус</th>
                  <th className="p-3">+/~/=</th>
                  <th className="p-3">⚠/✕</th>
                </tr>
              </thead>
              <tbody>
                {batches.data?.batches.map((b) => (
                  <tr key={b.id} className="border-t border-line">
                    <td className="p-3">{b.id}</td>
                    <td className="p-3 whitespace-nowrap">{formatDateRu(b.createdAt)}</td>
                    <td className="p-3">{b.fileName}</td>
                    <td className="p-3">{b.mode === "dry_run" ? "проверка" : "применён"}</td>
                    <td className="p-3">
                      {b.status === "success" ? "✓" : b.status === "partial" ? "⚠" : "✕"}
                    </td>
                    <td className="p-3">{b.created}/{b.updated}/{b.unchanged}</td>
                    <td className="p-3">{b.warnings}/{b.errors}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2 className="mt-10 text-lg font-bold">Сопоставление разделов</h2>
          <p className="mt-1 text-sm text-neutral-600">
            Разделы прайс-листа привязываются к публичным категориям здесь — а не по слову в названии товара.
          </p>
          <ul className="mt-4 space-y-2 text-sm">
            {mappings.data?.mappings.map((m) => {
              const cat = mappings.data.categories.find((c) => c.id === m.categoryId);
              return (
                <li key={m.id} className="flex items-center justify-between border border-line px-4 py-2">
                  <span>«{m.sourceSection}»</span>
                  <span className="font-semibold">→ {cat?.name ?? `#${m.categoryId}`}</span>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </div>
  );
}
