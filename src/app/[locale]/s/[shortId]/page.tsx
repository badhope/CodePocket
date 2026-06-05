import { setRequestLocale } from "next-intl/server";
import ShareViewClient from "./share-view-client";

// Static export must know which dynamic paths to render; the client
// component fetches its content at runtime, so a single placeholder
// pre-render is enough to satisfy the build. The client will hydrate
// with real data only for the actual shortIds.
export function generateStaticParams() {
  return [{ shortId: "_" }];
}

export default async function ShareViewPage({
  params,
}: {
  params: Promise<{ locale: string; shortId: string }>;
}) {
  const { locale, shortId } = await params;
  setRequestLocale(locale);
  return <ShareViewClient shortId={shortId} />;
}
