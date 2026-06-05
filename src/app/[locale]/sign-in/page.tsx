"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Code2 } from "lucide-react";
import { Link } from "@/lib/i18n/navigation";
import { BackendGate } from "@/components/system/backend-gate";

function GitHubIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M12 .5C5.73.5.5 5.73.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56v-2.16c-3.2.7-3.88-1.37-3.88-1.37-.52-1.34-1.28-1.7-1.28-1.7-1.05-.72.08-.71.08-.71 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.7 0-1.26.45-2.29 1.18-3.1-.12-.29-.51-1.46.11-3.04 0 0 .97-.31 3.17 1.18a10.96 10.96 0 0 1 5.78 0c2.2-1.49 3.16-1.18 3.16-1.18.63 1.58.24 2.75.12 3.04.74.81 1.18 1.84 1.18 3.1 0 4.43-2.7 5.41-5.27 5.69.41.36.78 1.06.78 2.14v3.18c0 .31.21.68.8.56C20.21 21.39 23.5 17.08 23.5 12 23.5 5.73 18.27.5 12 .5Z" />
    </svg>
  );
}

function SignInForm() {
  const t = useTranslations("auth");
  const tc = useTranslations("common");
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") ?? "/dashboard";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await signIn("credentials", { email, password, redirect: false });
      if (res?.error) {
        setError(t("errors.invalidCredentials"));
      } else {
        router.push(callbackUrl);
        router.refresh();
      }
    } catch {
      setError(t("errors.generic"));
    } finally {
      setLoading(false);
    }
  }

  async function onOAuth(provider: "github" | "google") {
    setLoading(true);
    await signIn(provider, { callbackUrl });
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <Code2 className="text-primary mx-auto mb-2 size-8" />
        <CardTitle>{t("signInTitle")}</CardTitle>
        <CardDescription>{t("welcomeSubtitle")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">{t("emailLabel")}</Label>
            <Input
              id="email"
              type="email"
              placeholder={t("emailPlaceholder")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">{t("passwordLabel")}</Label>
            <Input
              id="password"
              type="password"
              placeholder={t("passwordPlaceholder")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              disabled={loading}
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
            {t("signInButton")}
          </Button>
        </form>
        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card text-muted-foreground px-2">{t("orContinueWith")}</span>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-2">
          <Button variant="outline" onClick={() => onOAuth("github")} disabled={loading}>
            <GitHubIcon className="mr-2 size-4" /> {t("signInWith", { provider: "GitHub" })}
          </Button>
        </div>
        <p className="text-muted-foreground mt-4 text-center text-sm">
          {t("noAccount")}{" "}
          <Link href="/sign-up" className="text-foreground font-medium hover:underline">
            {tc("signUp")}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

export default function SignInPage() {
  return (
    <BackendGate feature="auth.sign-in">
      <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center p-4">
        <Suspense fallback={<div className="text-muted-foreground">Loading…</div>}>
          <SignInForm />
        </Suspense>
      </div>
    </BackendGate>
  );
}
