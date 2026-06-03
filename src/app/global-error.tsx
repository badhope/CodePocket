"use client"

import { useEffect } from "react"
import { AlertTriangle, RefreshCw } from "lucide-react"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("Root-level error:", error)
  }, [error])

  return (
    <html lang="en">
      <body>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
            fontFamily: "system-ui, -apple-system, sans-serif",
            background: "#fafafa",
            color: "#0a0a0a",
          }}
        >
          <div
            style={{
              maxWidth: "32rem",
              width: "100%",
              background: "white",
              border: "1px solid #e5e5e5",
              borderRadius: "0.75rem",
              padding: "1.5rem",
              textAlign: "center",
            }}
          >
            <div
              style={{
                display: "inline-flex",
                width: "3rem",
                height: "3rem",
                borderRadius: "9999px",
                background: "#fee2e2",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 1rem",
              }}
            >
              <AlertTriangle style={{ width: "1.5rem", height: "1.5rem", color: "#dc2626" }} />
            </div>
            <h1 style={{ fontSize: "1.5rem", fontWeight: 600, marginBottom: "0.5rem" }}>
              Critical Error
            </h1>
            <p style={{ color: "#737373", marginBottom: "1.5rem" }}>
              A critical error occurred. Please refresh the page.
            </p>
            {error.digest && (
              <p style={{ fontSize: "0.75rem", color: "#a3a3a3", marginBottom: "1rem" }}>
                Error ID: {error.digest}
              </p>
            )}
            <button
              onClick={reset}
              style={{
                background: "#0a0a0a",
                color: "white",
                border: "none",
                borderRadius: "0.5rem",
                padding: "0.5rem 1rem",
                fontSize: "0.875rem",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              <RefreshCw style={{ width: "1rem", height: "1rem" }} />
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
