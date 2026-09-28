import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://satulabs.id";

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/landing-page", "/privacy", "/terms", "/auth/"],
        disallow: ["/app/", "/admin/", "/api/"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
