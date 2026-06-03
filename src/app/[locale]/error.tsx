"use client"

import { useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertTriangle, Home, RefreshCw, Bug } from "lucide-react"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("App-level error:", error)
  }, [error])

  const isDev = process.env.NODE_ENV === "development"

  return (
    <div className="container mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center p-4">
      <Card className="max-w-lg">
        <CardHeader>
          <div className="mb-2 flex size-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="size-6 text-destructive" />
          </div>
          <CardTitle>Something went wrong</CardTitle>
          <CardDescription>
            We&apos;ve been notified. You can try again or head back home.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {isDev && (
            <Alert variant="destructive">
              <Bug className="size-4" />
              <AlertTitle>Development error</AlertTitle>
              <AlertDescription className="break-all font-mono text-xs">
                {error.message}
                {error.digest && (
                  <span className="mt-1 block opacity-70">Digest: {error.digest}</span>
                )}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
        <CardFooter className="flex justify-end gap-2">
          <Button asChild variant="outline">
            <Link href="/">
              <Home className="mr-2 size-4" />
              Go home
            </Link>
          </Button>
          <Button onClick={reset}>
            <RefreshCw className="mr-2 size-4" />
            Try again
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
