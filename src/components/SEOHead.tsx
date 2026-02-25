import { useEffect } from "react";

// Normaliza o título para garantir que sempre use "{a}AutoZap"
const normalizeTitle = (title: string): string => {
  return title
    // Primeiro, substitui variações erradas do nome
    .replace(/ClickZap/gi, "{a}AutoZap")
    .replace(/Appi\s*AutoZap/gi, "{a}AutoZap")
    // Depois, adiciona {a} onde falta (mas não duplica se já existe)
    .replace(/(?<!\{a\})AutoZap/gi, "{a}AutoZap");
};

interface SEOHeadProps {
  title: string;
  description: string;
  image?: string;
  url?: string;
  type?: "website" | "article";
  publishedTime?: string;
  modifiedTime?: string;
  author?: string;
  section?: string;
  keywords?: string;
}

const updateMetaTag = (property: string, content: string) => {
  let meta = document.querySelector(`meta[property="${property}"]`) ||
             document.querySelector(`meta[name="${property}"]`);
  
  if (meta) {
    meta.setAttribute("content", content);
  } else {
    meta = document.createElement("meta");
    if (property.startsWith("og:") || property.startsWith("article:")) {
      meta.setAttribute("property", property);
    } else {
      meta.setAttribute("name", property);
    }
    meta.setAttribute("content", content);
    document.head.appendChild(meta);
  }
};

const updateCanonical = (url: string) => {
  let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
  
  if (link) {
    link.href = url;
  } else {
    link = document.createElement("link");
    link.rel = "canonical";
    link.href = url;
    document.head.appendChild(link);
  }
};

export const SEOHead = ({
  title,
  description,
  image = "https://appiautozap.com/og-image.png",
  url = "https://appiautozap.com",
  type = "website",
  publishedTime,
  modifiedTime,
  author,
  section,
  keywords = "automação whatsapp, chatbot whatsapp, atendimento automático, whatsapp business, bot whatsapp, ia whatsapp",
}: SEOHeadProps) => {
  useEffect(() => {
    // Normaliza o título para garantir consistência da marca
    const normalizedTitle = normalizeTitle(title);
    
    // Update document title
    document.title = normalizedTitle;

    // Basic meta tags
    updateMetaTag("description", description);
    updateMetaTag("keywords", keywords);
    
    // Open Graph tags
    updateMetaTag("og:title", normalizedTitle);
    updateMetaTag("og:description", description);
    updateMetaTag("og:image", image);
    updateMetaTag("og:url", url);
    updateMetaTag("og:type", type);
    updateMetaTag("og:site_name", "{a}AutoZap");
    updateMetaTag("og:locale", "pt_BR");

    // Twitter Card tags
    updateMetaTag("twitter:card", "summary_large_image");
    updateMetaTag("twitter:title", normalizedTitle);
    updateMetaTag("twitter:description", description);
    updateMetaTag("twitter:image", image);

    // Article-specific tags
    if (type === "article") {
      if (publishedTime) {
        updateMetaTag("article:published_time", publishedTime);
      }
      if (modifiedTime) {
        updateMetaTag("article:modified_time", modifiedTime);
      }
      if (author) {
        updateMetaTag("article:author", author);
      }
      if (section) {
        updateMetaTag("article:section", section);
      }
    }

    // Canonical URL
    updateCanonical(url);

    // Cleanup function to reset meta tags on unmount
    return () => {
      // Optional: Reset to default values when component unmounts
    };
  }, [title, description, image, url, type, publishedTime, modifiedTime, author, section, keywords]);

  return null;
};

export default SEOHead;
