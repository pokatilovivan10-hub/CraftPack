import { Link, useSearchParams } from "react-router";
import { SearchX } from "lucide-react";
import { Seo } from "@/lib/Seo";

export default function NotFound() {
  const [params] = useSearchParams();
  void params;
  return (
    <div className="kp-container flex flex-col items-center py-24 text-center">
      <Seo title="Страница не найдена" noindex />
      <SearchX className="h-14 w-14 text-neutral-300" aria-hidden />
      <p className="mt-6 text-sm font-semibold uppercase tracking-widest text-neutral-500">Ошибка 404</p>
      <h1 className="kp-h2 mt-2">Такой страницы нет</h1>
      <p className="mt-4 max-w-md text-sm text-neutral-600">
        Возможно, адрес изменился после обновления каталога. Попробуйте поиск
        или перейдите в нужный раздел.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-4">
        <Link to="/catalog" className="kp-btn-primary">
          Перейти в каталог
        </Link>
        <Link to="/search" className="kp-btn-outline">
          Поиск по сайту
        </Link>
      </div>
    </div>
  );
}
