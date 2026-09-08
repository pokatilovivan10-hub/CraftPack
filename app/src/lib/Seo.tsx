import { useEffect } from "react";

export interface SeoProps {
  title: string;
  description?: string;
  canonicalPath?: string;
  noindex?: boolean;
  ogImage?: string | null;
  jsonLd?: object | object[];
}

const SITE = "KRAFTPAK";

export function Seo({ title, description, canonicalPath, noindex, ogImage, jsonLd }: SeoProps) {
  useEffect(() => {
    document.title = title === SITE ? SITE : `${title} — ${SITE}`;

    setMeta("description", description);
    setMeta("robots", noindex ? "noindex, nofollow" : null);
    setMeta("og:title", title, "property");
    setMeta("og:description", description, "property");
    setMeta("og:type", "website", "property");
    if (ogImage) setMeta("og:image", ogImage, "property");

    let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (canonicalPath) {
      if (!canonical) {
        canonical = document.createElement("link");
        canonical.rel = "canonical";
        document.head.appendChild(canonical);
      }
      canonical.href = window.location.origin + canonicalPath;
    }

    const id = "kp-jsonld";
    document.getElementById(id)?.remove();
    if (jsonLd) {
      const script = document.createElement("script");
      script.id = id;
      script.type = "application/ld+json";
      script.textContent = JSON.stringify(Array.isArray(jsonLd) ? jsonLd : [jsonLd]);
      document.head.appendChild(script);
    }
    return () => {
      document.getElementById(id)?.remove();
    };
  }, [title, description, canonicalPath, noindex, ogImage, JSON.stringify(jsonLd)]);

  return null;
}

function setMeta(name: string, content: string | null | undefined, attr: "name" | "property" = "name") {
  const selector = `meta[${attr}="${name}"]`;
  let el = document.querySelector<HTMLMetaElement>(selector);
  if (!content) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.content = content;
}
