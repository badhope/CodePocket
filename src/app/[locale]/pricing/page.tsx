import { getTranslations, setRequestLocale } from "next-intl/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";

export default async function PricingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("nav");
  const tc = await getTranslations("common");

  const tiers = [
    {
      name: "Free",
      price: "$0",
      period: "/month",
      description: "Perfect for occasional document conversions.",
      features: [
        "10 conversions/day",
        "Max 10MB per file",
        "100MB storage",
        "All supported formats",
        "Community support",
        "Basic quality",
      ],
      cta: "Get Started",
      href: "/sign-up",
      highlighted: false,
    },
    {
      name: "Pro",
      price: "$12",
      period: "/month",
      description: "For professionals who need more power and speed.",
      features: [
        "500 conversions/day",
        "Max 50MB per file",
        "1GB storage",
        "Batch processing",
        "Priority conversion queue",
        "High quality output",
        "Email support",
        "API access",
      ],
      cta: "Upgrade to Pro",
      href: "/sign-up",
      highlighted: true,
    },
    {
      name: "Enterprise",
      price: "$49",
      period: "/month",
      description: "For teams and organizations with advanced needs.",
      features: [
        "Unlimited conversions",
        "Max 200MB per file",
        "10GB storage",
        "Batch & bulk processing",
        "Dedicated processing",
        "Maximum quality output",
        "Priority support",
        "API access",
        "Custom integrations",
        "SLA guarantee",
      ],
      cta: "Contact Sales",
      href: "/sign-up",
      highlighted: false,
    },
  ];

  return (
    <div className="container mx-auto max-w-7xl px-4 py-12">
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="mb-3 text-3xl font-bold tracking-tight md:text-4xl">{t("pricing")}</h1>
        <p className="text-muted-foreground mb-12 text-lg">
          Choose the plan that fits your document conversion needs. Upgrade anytime.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {tiers.map((tier) => (
          <Card key={tier.name} className={tier.highlighted ? "border-primary shadow-lg" : ""}>
            <CardHeader>
              {tier.highlighted && <Badge className="mb-3 w-fit">Popular</Badge>}
              <CardTitle>{tier.name}</CardTitle>
              <div className="mt-2">
                <span className="text-3xl font-bold">{tier.price}</span>
                <span className="text-muted-foreground text-sm">{tier.period}</span>
              </div>
              <CardDescription>{tier.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <ul className="space-y-2 text-sm">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <Check className="text-primary size-4 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button className="mt-auto w-full" variant={tier.highlighted ? "default" : "outline"} asChild>
                <Link href={tier.href}>{tier.cta}</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="text-muted-foreground mt-8 text-center text-sm">
        {tc("comingSoon")}: Custom enterprise plans, dedicated infrastructure, and on-premise deployment.
      </p>
    </div>
  );
}
