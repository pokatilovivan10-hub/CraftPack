import { Link } from "react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Props {
  page: number;
  pageSize: number;
  total: number;
  /** Формирует URL для страницы с сохранением остальных параметров */
  makeHref: (page: number) => string;
}

export function Pagination({ page, pageSize, total, makeHref }: Props) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;

  const window = 2;
  const nums: (number | "…")[] = [];
  for (let p = 1; p <= pages; p++) {
    if (p === 1 || p === pages || Math.abs(p - page) <= window) nums.push(p);
    else if (nums[nums.length - 1] !== "…") nums.push("…");
  }

  return (
    <nav aria-label="Пагинация" className="mt-10 flex items-center justify-center gap-1">
      {page > 1 && (
        <Link
          to={makeHref(page - 1)}
          className="flex h-11 w-11 items-center justify-center border border-line hover:bg-fog"
          aria-label="Предыдущая страница"
          rel="prev"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
        </Link>
      )}
      {nums.map((n, i) =>
        n === "…" ? (
          <span key={`e${i}`} className="px-2 text-neutral-400" aria-hidden>
            …
          </span>
        ) : (
          <Link
            key={n}
            to={makeHref(n)}
            aria-current={n === page ? "page" : undefined}
            className={`flex h-11 min-w-11 items-center justify-center border px-3 text-sm font-medium ${
              n === page ? "border-ink bg-ink text-white" : "border-line hover:bg-fog"
            }`}
          >
            {n}
          </Link>
        ),
      )}
      {page < pages && (
        <Link
          to={makeHref(page + 1)}
          className="flex h-11 w-11 items-center justify-center border border-line hover:bg-fog"
          aria-label="Следующая страница"
          rel="next"
        >
          <ChevronRight className="h-4 w-4" aria-hidden />
        </Link>
      )}
    </nav>
  );
}
