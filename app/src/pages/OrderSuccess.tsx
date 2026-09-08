import { Link, useSearchParams } from "react-router";
import { CheckCircle2 } from "lucide-react";
import { Seo } from "@/lib/Seo";
import { formatPrice } from "@/lib/format";
import { site } from "@/config/site";

export default function OrderSuccess() {
  const [params] = useSearchParams();
  const number = params.get("number") ?? "";
  const total = params.get("total");

  return (
    <div className="kp-container flex flex-col items-center py-24 text-center">
      <Seo title="Заявка отправлена" noindex />
      <CheckCircle2 className="h-14 w-14 text-green-700" aria-hidden />
      <h1 className="kp-h2 mt-6">Заявка {number && <>№ {number} </>}отправлена</h1>
      {total && total !== "0.00" && (
        <p className="mt-3 text-lg">
          Предварительная сумма: <strong>{formatPrice(total)}</strong>
        </p>
      )}
      <p className="mt-4 max-w-md text-sm text-neutral-600">
        Менеджер подтвердит наличие, итоговую стоимость и способ получения.
        Работаем {site.workHours.toLowerCase()}.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-4">
        <Link to="/catalog" className="kp-btn-primary">
          Вернуться в каталог
        </Link>
        <Link to="/" className="kp-btn-outline">
          На главную
        </Link>
      </div>
    </div>
  );
}
