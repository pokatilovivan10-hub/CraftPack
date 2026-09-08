import { Seo } from "@/lib/Seo";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { ConsultationForm } from "@/components/ConsultationForm";
import { site } from "@/config/site";
import { Phone, Mail, MapPin, Clock } from "lucide-react";

export default function Contacts() {
  const mapQuery = encodeURIComponent(site.address);
  return (
    <div className="kp-container py-8">
      <Seo
        title="Контакты"
        description={`${site.name}: ${site.address}. ${site.phone}, ${site.email}. ${site.workHours}.`}
        canonicalPath="/contacts"
      />
      <Breadcrumbs items={[{ label: "Контакты" }]} />
      <h1 className="kp-h1 mt-6">Контакты</h1>

      <div className="mt-10 grid gap-10 lg:grid-cols-2">
        <address className="space-y-6 not-italic">
          <div className="flex gap-4">
            <MapPin className="mt-1 h-5 w-5 shrink-0" aria-hidden />
            <div>
              <p className="font-bold">Адрес</p>
              <p className="mt-1 text-neutral-700">{site.address}</p>
              <a
                href={`https://yandex.ru/maps/?text=${mapQuery}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block text-sm font-semibold underline"
              >
                Открыть в Яндекс.Картах
              </a>
            </div>
          </div>
          <div className="flex gap-4">
            <Phone className="mt-1 h-5 w-5 shrink-0" aria-hidden />
            <div>
              <p className="font-bold">Телефон</p>
              <a href={site.phoneHref} className="mt-1 block text-xl font-extrabold hover:underline">
                {site.phone}
              </a>
            </div>
          </div>
          <div className="flex gap-4">
            <Mail className="mt-1 h-5 w-5 shrink-0" aria-hidden />
            <div>
              <p className="font-bold">Email</p>
              <a href={`mailto:${site.email}`} className="mt-1 block hover:underline">
                {site.email}
              </a>
            </div>
          </div>
          <div className="flex gap-4">
            <Clock className="mt-1 h-5 w-5 shrink-0" aria-hidden />
            <div>
              <p className="font-bold">Часы работы</p>
              <p className="mt-1 text-neutral-700">{site.workHours}</p>
            </div>
          </div>
        </address>

        <div className="border border-line p-6 md:p-8">
          <h2 className="text-xl font-bold">Форма обратной связи</h2>
          <div className="mt-4">
            <ConsultationForm title="" context="contacts" />
          </div>
        </div>
      </div>
    </div>
  );
}
