import { Seo } from "@/lib/Seo";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { ConsultationForm } from "@/components/ConsultationForm";

const STEPS = [
  ["Заявка", "Вы описываете задачу: тираж, тип упаковки, сроки."],
  ["Макет", "Согласовываем макет нанесения и материал."],
  ["Производство", "Печатаем и изготавливаем тираж."],
  ["Отгрузка", "Передаём готовую продукцию вам или в службу доставки."],
];

export default function CustomLogo() {
  return (
    <div className="kp-container py-8">
      <Seo
        title="Продукция с вашим логотипом"
        description="Индивидуальное производство упаковки с логотипом: коробки, пакеты, ленты. Расчёт тиража от KRAFTPAK."
        canonicalPath="/custom-logo"
      />
      <Breadcrumbs items={[{ label: "Продукция с вашим логотипом" }]} />

      <section className="mt-6 bg-ink p-8 text-white md:p-14">
        <p className="mb-4 inline-block bg-brand px-3 py-1 text-xs font-bold uppercase tracking-widest text-ink">
          Индивидуальное производство
        </p>
        <h1 className="kp-h1 max-w-3xl">Продукция с вашим логотипом</h1>
        <p className="mt-5 max-w-xl text-white/75">
          Нанесём логотип на упаковку из нашего ассортимента или изготовим
          продукцию под вашу задачу.
        </p>
      </section>

      <section className="mt-14" aria-labelledby="steps-h">
        <h2 id="steps-h" className="kp-h2">Как это работает</h2>
        <ol className="mt-8 grid gap-px bg-line sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map(([t, d], i) => (
            <li key={t} className="bg-white p-7">
              <p className="text-4xl font-extrabold text-brand">{i + 1}</p>
              <p className="mt-3 font-bold">{t}</p>
              <p className="mt-2 text-sm text-neutral-600">{d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-14" aria-labelledby="req-h">
        <h2 id="req-h" className="kp-h2">Требования к макету</h2>
        <ul className="mt-6 list-disc space-y-2 pl-6 text-neutral-700">
          <li>Векторный файл (AI, EPS, PDF) или растровый в высоком разрешении.</li>
          <li>Минимальный тираж и способы нанесения уточняются при расчёте заказа.</li>
          <li>Сроки производства согласуются после утверждения макета.</li>
        </ul>
      </section>

      <section className="mt-14 grid gap-10 border border-line p-6 md:grid-cols-2 md:p-12" aria-labelledby="calc-h">
        <div>
          <h2 id="calc-h" className="kp-h2">Заказать расчёт</h2>
          <p className="mt-3 text-sm text-neutral-600">
            Укажите тип упаковки, тираж и срок — менеджер подготовит расчёт.
            Детали можно добавить в комментарии.
          </p>
        </div>
        <ConsultationForm title="" context="custom-logo" variant="branding" />
      </section>
    </div>
  );
}
