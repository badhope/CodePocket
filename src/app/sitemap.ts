import type { MetadataRoute } from "next"

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  const now = new Date()
  return [
    { url: base, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${base}/convert`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/pricing`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${base}/docs`, lastModified: now, changeFrequency: "weekly", priority: 0.6 },
  ]
}