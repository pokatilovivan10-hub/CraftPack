import { Link } from "react-router";
import { ChevronRight } from "lucide-react";

export interface Crumb {
  label: string;
  to?: string;
}

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Хлебные крошки" className="text-sm">
      <ol className="flex flex-wrap items-center gap-1">
        <li>
          <Link to="/" className="text-neutral-500 hover:text-ink hover:underline">
            Главная
          </Link>
        </li>
        {items.map((item, i) => (
          <li key={i} className="flex items-center gap-1">
            <ChevronRight className="h-3.5 w-3.5 text-neutral-400" aria-hidden />
            {item.to && i < items.length - 1 ? (
              <Link to={item.to} className="text-neutral-500 hover:text-ink hover:underline">
                {item.label}
              </Link>
            ) : (
              <span aria-current={i === items.length - 1 ? "page" : undefined} className="text-ink">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
