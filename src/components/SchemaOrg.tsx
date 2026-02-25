import { useEffect } from "react";

interface BlogPostingSchema {
  type: "BlogPosting";
  title: string;
  description: string;
  image: string;
  datePublished: string;
  dateModified?: string;
  author: string;
  url: string;
}

interface OrganizationSchema {
  type: "Organization";
  name: string;
  url: string;
  logo: string;
  description?: string;
  sameAs?: string[];
}

interface BreadcrumbItem {
  name: string;
  url: string;
}

interface BreadcrumbSchema {
  type: "BreadcrumbList";
  items: BreadcrumbItem[];
}

interface FAQItem {
  question: string;
  answer: string;
}

interface FAQSchema {
  type: "FAQPage";
  items: FAQItem[];
}

interface WebSiteSchema {
  type: "WebSite";
  name: string;
  url: string;
  description: string;
}

type SchemaType = BlogPostingSchema | OrganizationSchema | BreadcrumbSchema | FAQSchema | WebSiteSchema;

interface SchemaOrgProps {
  schema: SchemaType;
}

const generateSchema = (schema: SchemaType): object => {
  switch (schema.type) {
    case "BlogPosting":
      return {
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        headline: schema.title,
        description: schema.description,
        image: schema.image,
        datePublished: schema.datePublished,
        dateModified: schema.dateModified || schema.datePublished,
        author: {
          "@type": "Organization",
          name: schema.author,
          url: "https://appiautozap.com",
        },
        publisher: {
          "@type": "Organization",
          name: "AutoZap",
          logo: {
            "@type": "ImageObject",
            url: "https://appiautozap.com/logo.png",
          },
        },
        mainEntityOfPage: {
          "@type": "WebPage",
          "@id": schema.url,
        },
      };

    case "Organization":
      return {
        "@context": "https://schema.org",
        "@type": "Organization",
        name: schema.name,
        url: schema.url,
        logo: schema.logo,
        description: schema.description,
        sameAs: schema.sameAs || [],
        contactPoint: {
          "@type": "ContactPoint",
          email: "contato@appicompany.com",
          contactType: "customer service",
          availableLanguage: "Portuguese",
        },
      };

    case "BreadcrumbList":
      return {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: schema.items.map((item, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: item.name,
          item: item.url,
        })),
      };

    case "FAQPage":
      return {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: schema.items.map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: item.answer,
          },
        })),
      };

    case "WebSite":
      return {
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: schema.name,
        url: schema.url,
        description: schema.description,
        potentialAction: {
          "@type": "SearchAction",
          target: `${schema.url}/blog?q={search_term_string}`,
          "query-input": "required name=search_term_string",
        },
      };

    default:
      return {};
  }
};

export const SchemaOrg = ({ schema }: SchemaOrgProps) => {
  useEffect(() => {
    const scriptId = `schema-org-${schema.type}`;
    
    // Remove existing script if present
    const existingScript = document.getElementById(scriptId);
    if (existingScript) {
      existingScript.remove();
    }

    // Create new script
    const script = document.createElement("script");
    script.id = scriptId;
    script.type = "application/ld+json";
    script.textContent = JSON.stringify(generateSchema(schema));
    document.head.appendChild(script);

    return () => {
      const scriptToRemove = document.getElementById(scriptId);
      if (scriptToRemove) {
        scriptToRemove.remove();
      }
    };
  }, [schema]);

  return null;
};

export default SchemaOrg;
