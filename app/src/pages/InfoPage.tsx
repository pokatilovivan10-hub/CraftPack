import { Link } from "react-router";
import { trpc } from "@/providers/trpc";
import { Seo } from "@/lib/Seo";
import { Breadcrumbs } from "@/components/Breadcrumbs";

interface Props {
  slug: string;
  title: string;
  seoDescription: string;
  /** Текст по умолчанию, если страницы нет в базе */
  fallback?: string;
  /** Честное пустое состояние для списков (новости/вакансии) */
  emptyState?: string;
}

/** Универсальная контентная страница: берёт текст из БД, иначе показывает заготовку. */
export default function InfoPage({ slug, title, seoDescription, fallback, emptyState }: Props) {
  const { data: page, isLoading } = trpc.content.page.useQuery({ slug });

  const content = page?.content ?? fallback;

  return (
    <div className="kp-container py-8">
      <Seo title={title} description={seoDescription} canonicalPath={`/${slug}`} />
      <Breadcrumbs items={[{ label: title }]} />
      <h1 className="kp-h1 mt-6">{title}</h1>
      <div className="mt-8 max-w-3xl">
        {isLoading ? (
          <div className="space-y-3">
            <div className="h-4 w-full animate-pulse bg-fog" />
            <div className="h-4 w-2/3 animate-pulse bg-fog" />
          </div>
        ) : content ? (
          <div className="whitespace-pre-line leading-relaxed text-neutral-700">{content}</div>
        ) : (
          <div className="border border-line p-8 text-center" role="status">
            <p className="text-lg font-bold">{emptyState ?? "Раздел наполняется"}</p>
            <p className="mt-2 text-sm text-neutral-600">
              Материалы появятся здесь позже. А пока — загляните в каталог.
            </p>
            <Link to="/catalog" className="kp-btn-primary mt-6">
              Перейти в каталог
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
