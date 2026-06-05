"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLocale } from "next-intl";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  ArrowLeftRight,
  ArrowRight,
  Check,
  Copy,
  Download,
  Eraser,
  RefreshCw,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import * as T from "@/lib/tools/client-tools";

type ToolId =
  | "json-format"
  | "css-format"
  | "sql-format"
  | "html-format"
  | "yaml-json"
  | "toml-json"
  | "csv-json"
  | "md-html"
  | "base64"
  | "url"
  | "hash"
  | "jwt"
  | "uuid"
  | "color"
  | "number-base"
  | "cron"
  | "regex"
  | "diff"
  | "lorem"
  | "qrcode";

export function ToolRunner({
  slug,
  title,
  description,
  breadcrumbLabel,
}: {
  slug: ToolId;
  title: string;
  description: string;
  breadcrumbLabel: string;
}) {
  const locale = useLocale();

  return (
    <div className="container mx-auto max-w-6xl space-y-6 px-4 py-6 md:py-10">
      <div className="flex items-center gap-2 text-sm">
        <Link
          href={`/${locale}/tools` as never}
          className="text-muted-foreground hover:text-foreground flex items-center gap-1"
        >
          ← {breadcrumbLabel}
        </Link>
      </div>

      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{title}</h1>
        <p className="text-muted-foreground text-sm">{description}</p>
      </header>

      <ToolBody slug={slug} />
    </div>
  );
}

function ToolBody({ slug }: { slug: ToolId }) {
  switch (slug) {
    case "json-format":
      return <JsonFormatTool />;
    case "css-format":
      return <CssFormatTool />;
    case "sql-format":
      return <SqlFormatTool />;
    case "html-format":
      return <HtmlFormatTool />;
    case "yaml-json":
      return <YamLJsonTool />;
    case "toml-json":
      return <TomlJsonTool />;
    case "csv-json":
      return <CsvJsonTool />;
    case "md-html":
      return <MdHtmlTool />;
    case "base64":
      return <Base64Tool />;
    case "url":
      return <UrlTool />;
    case "hash":
      return <HashTool />;
    case "jwt":
      return <JwtTool />;
    case "uuid":
      return <UuidTool />;
    case "color":
      return <ColorTool />;
    case "number-base":
      return <NumberBaseTool />;
    case "cron":
      return <CronTool />;
    case "regex":
      return <RegexTool />;
    case "diff":
      return <DiffTool />;
    case "lorem":
      return <LoremTool />;
    case "qrcode":
      return <QrTool />;
  }
}

// ─────────────────────────────────────────────────────────────────────
// Generic two-pane converter
// ─────────────────────────────────────────────────────────────────────

function TwoPane({
  leftLabel,
  rightLabel,
  leftPlaceholder,
  rightPlaceholder,
  defaultLeft,
  convert,
  swap = false,
  error,
}: {
  leftLabel: string;
  rightLabel: string;
  leftPlaceholder?: string;
  rightPlaceholder?: string;
  defaultLeft?: string;
  convert: (left: string) => string | { ok: true; output: string } | { ok: false; error: string };
  swap?: boolean;
  error?: string | null;
}) {
  const [left, setLeft] = useState(defaultLeft ?? "");
  const [right, setRight] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const run = (input: string) => {
    try {
      const out = convert(input);
      if (typeof out === "string") {
        setRight(out);
        setErr(null);
      } else if (out.ok) {
        setRight(out.output);
        setErr(null);
      } else {
        setRight("");
        setErr(out.error);
      }
    } catch (e) {
      setRight("");
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">{leftLabel}</Label>
          <div className="flex items-center gap-1">
            <Button size="sm" variant="outline" onClick={() => run(left)} className="h-7 text-xs">
              <RefreshCw className="mr-1 size-3" /> Convert
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setLeft("")}
              className="size-7"
              aria-label="Clear"
            >
              <Eraser className="size-3" />
            </Button>
          </div>
        </div>
        <Textarea
          value={left}
          onChange={(e) => setLeft(e.target.value)}
          placeholder={leftPlaceholder}
          className="min-h-[320px] font-mono text-xs"
        />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">{rightLabel}</Label>
          <div className="flex items-center gap-1">
            {swap && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setLeft(right);
                  setRight(left);
                }}
                className="h-7 text-xs"
              >
                <ArrowLeftRight className="mr-1 size-3" /> Swap
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                void navigator.clipboard.writeText(right).then(() => toast.success("Copied"));
              }}
              disabled={!right}
              className="h-7 text-xs"
            >
              <Copy className="mr-1 size-3" /> Copy
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                const blob = new Blob([right], { type: "text/plain" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "output.txt";
                a.click();
                URL.revokeObjectURL(url);
              }}
              disabled={!right}
              className="h-7 text-xs"
            >
              <Download className="mr-1 size-3" /> Save
            </Button>
          </div>
        </div>
        <Textarea
          value={right}
          readOnly
          placeholder={rightPlaceholder ?? "Output appears here"}
          className="bg-muted/30 min-h-[320px] font-mono text-xs"
        />
        {(err ?? error) && (
          <Alert variant="destructive">
            <AlertDescription className="font-mono text-xs">{err ?? error}</AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// JSON formatter (with pretty/minify + tree view)
// ─────────────────────────────────────────────────────────────────────

function JsonFormatTool() {
  const [left, setLeft] = useState('{"hello":"world","items":[1,2,3],"nested":{"a":true,"b":null}}');
  const [right, setRight] = useState("");
  const [view, setView] = useState<"text" | "tree">("text");
  const [err, setErr] = useState<string | null>(null);

  const run = (action: "pretty" | "minify") => {
    const fn = action === "pretty" ? T.formatJson(left, 2) : T.minifyJson(left);
    if (fn.ok) {
      setRight(fn.output);
      setErr(null);
    } else {
      setRight("");
      setErr(fn.error);
    }
  };

  const tree = useMemo(() => {
    if (view !== "tree" || !right) return null;
    return T.jsonToTree(right);
  }, [view, right]);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Input JSON</Label>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="outline" onClick={() => run("pretty")} className="h-7 text-xs">
                <Sparkles className="mr-1 size-3" /> Beautify
              </Button>
              <Button size="sm" variant="ghost" onClick={() => run("minify")} className="h-7 text-xs">
                Minify
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setLeft("")}
                className="size-7"
                aria-label="Clear"
              >
                <Eraser className="size-3" />
              </Button>
            </div>
          </div>
          <Textarea
            value={left}
            onChange={(e) => setLeft(e.target.value)}
            className="min-h-[360px] font-mono text-xs"
          />
          {err && (
            <Alert variant="destructive">
              <AlertDescription className="font-mono text-xs">{err}</AlertDescription>
            </Alert>
          )}
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Output</Label>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant={view === "text" ? "default" : "ghost"}
                onClick={() => setView("text")}
                className="h-7 text-xs"
              >
                Text
              </Button>
              <Button
                size="sm"
                variant={view === "tree" ? "default" : "ghost"}
                onClick={() => setView("tree")}
                className="h-7 text-xs"
              >
                Tree
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={!right}
                onClick={() => {
                  void navigator.clipboard.writeText(right).then(() => toast.success("Copied"));
                }}
                className="h-7 text-xs"
              >
                <Copy className="mr-1 size-3" /> Copy
              </Button>
            </div>
          </div>
          {view === "text" ? (
            <Textarea
              value={right}
              readOnly
              placeholder="Output appears here"
              className="bg-muted/30 min-h-[360px] font-mono text-xs"
            />
          ) : (
            <Card>
              <CardContent className="p-3">
                {tree && tree.ok ? (
                  <JsonTreeView node={tree.root} depth={0} />
                ) : (
                  <p className="text-muted-foreground text-xs">Run a conversion first.</p>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function JsonTreeView({ node, depth }: { node: T.JsonNode; depth: number }) {
  const [open, setOpen] = useState(depth < 2);
  const isContainer = node.kind === "object" || node.kind === "array";
  const colorClass =
    node.kind === "string"
      ? "text-emerald-600 dark:text-emerald-400"
      : node.kind === "number"
        ? "text-blue-600 dark:text-blue-400"
        : node.kind === "boolean"
          ? "text-amber-600 dark:text-amber-400"
          : node.kind === "null"
            ? "text-muted-foreground italic"
            : "text-foreground";
  return (
    <div className="font-mono text-xs leading-relaxed">
      <div style={{ paddingLeft: depth * 12 }}>
        {isContainer ? (
          <button onClick={() => setOpen((o) => !o)} className="hover:bg-muted -ml-1 rounded px-1">
            <span className="text-muted-foreground">{open ? "▾" : "▸"}</span>{" "}
            <span className={colorClass}>{node.key}</span>{" "}
            <span className="text-muted-foreground">
              {node.kind === "array" ? `[${node.children?.length ?? 0}]` : `{${node.children?.length ?? 0}}`}
            </span>
          </button>
        ) : (
          <span>
            <span className="text-foreground/70">{node.key}</span>
            <span className="text-muted-foreground">: </span>
            <span className={colorClass}>{String(node.value)}</span>
          </span>
        )}
      </div>
      {isContainer &&
        open &&
        node.children?.map((c, i) => (
          <JsonTreeView
            key={i}
            node={{ ...c, key: node.kind === "array" ? `[${c.key}]` : c.key }}
            depth={depth + 1}
          />
        ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// CSS / SQL / HTML formatters
// ─────────────────────────────────────────────────────────────────────

function CssFormatTool() {
  return (
    <TwoPane
      leftLabel="Input CSS"
      rightLabel="Output CSS"
      defaultLeft="body{margin:0;padding:0;font-family:system-ui;}.container{display:flex;gap:1rem;}"
      convert={(s) => T.formatCss(s)}
    />
  );
}

function SqlFormatTool() {
  return (
    <TwoPane
      leftLabel="Input SQL"
      rightLabel="Output SQL"
      defaultLeft="select id, name, email from users where active = true and created_at > '2024-01-01' order by id desc limit 100"
      convert={(s) => T.formatSql(s)}
    />
  );
}

function HtmlFormatTool() {
  return (
    <TwoPane
      leftLabel="Input HTML"
      rightLabel="Output HTML"
      defaultLeft={`<!DOCTYPE html><html><head><title>Hi</title></head><body><h1>Hello</h1><p>World</p></body></html>`}
      convert={(s) => T.formatHtml(s)}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────
// YAML / TOML / CSV / MD converters
// ─────────────────────────────────────────────────────────────────────

function YamLJsonTool() {
  return (
    <TwoPane
      leftLabel="YAML"
      rightLabel="JSON"
      defaultLeft={`name: DocForge\nversion: 3.0\nfeatures:\n  - format\n  - convert\n  - encode`}
      convert={(s) => T.yamlToJson(s, 2)}
    />
  );
}

function TomlJsonTool() {
  return (
    <TwoPane
      leftLabel="TOML"
      rightLabel="JSON"
      defaultLeft={`[package]\nname = "docforge"\nversion = "3.0.0"\nedition = "2024"`}
      convert={(s) => T.tomlToJson(s, 2)}
    />
  );
}

function CsvJsonTool() {
  return (
    <TwoPane
      leftLabel="CSV"
      rightLabel="JSON"
      defaultLeft={`name,age,city\nAlice,30,Beijing\nBob,25,Shanghai\nCarol,28,Shenzhen`}
      convert={(s) => T.csvToJson(s, 2)}
    />
  );
}

function MdHtmlTool() {
  return (
    <TwoPane
      leftLabel="Markdown"
      rightLabel="HTML"
      defaultLeft={`# Hello\n\nThis is **bold** and *italic* text.\n\n- one\n- two\n- three\n\n> A quote.\n\n\`\`\`js\nconsole.log('hi')\n\`\`\``}
      convert={(s) => T.markdownToHtml(s)}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────
// Base64 / URL / Hash
// ─────────────────────────────────────────────────────────────────────

function Base64Tool() {
  const [text, setText] = useState("Hello, 世界! 🌍");
  const [encoded, setEncoded] = useState("");
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-2">
        <Label>Plain text</Label>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="min-h-[280px] font-mono text-xs"
        />
        <div className="flex gap-2">
          <Button size="sm" onClick={() => setEncoded(T.encodeBase64(text))}>
            Encode → Base64
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setText(encoded);
              setEncoded("");
            }}
          >
            ← Use as input
          </Button>
        </div>
      </div>
      <div className="space-y-2">
        <Label>Base64</Label>
        <Textarea
          value={encoded}
          onChange={(e) => setEncoded(e.target.value)}
          className="bg-muted/30 min-h-[280px] font-mono text-xs"
        />
        <Button
          size="sm"
          onClick={() => {
            const r = T.decodeBase64(encoded);
            if (r.ok) {
              setText(r.output);
              setEncoded("");
            } else toast.error(r.error);
          }}
        >
          ← Decode to text
        </Button>
      </div>
    </div>
  );
}

function UrlTool() {
  return (
    <TwoPane
      leftLabel="Plain"
      rightLabel="URL-encoded"
      defaultLeft="https://example.com/path?a=1&b=hello world&c=中文"
      convert={(s) => T.encodeUrl(s)}
    />
  );
}

function HashTool() {
  const [text, setText] = useState("Hello, world!");
  const [algo, setAlgo] = useState<"SHA-1" | "SHA-256" | "SHA-384" | "SHA-512">("SHA-256");
  const [hashes, setHashes] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const out: Record<string, string> = {};
      out["MD5"] = T.md5(text);
      for (const a of ["SHA-1", "SHA-256", "SHA-384", "SHA-512"] as const) {
        out[a] = await T.hashText(text, a);
      }
      if (!cancelled) setHashes(out);
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [text]);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Input</Label>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="min-h-[140px] font-mono text-xs"
        />
      </div>
      <div className="space-y-2">
        <Label>Algorithms</Label>
        <div className="grid gap-3">
          {(["MD5", "SHA-1", "SHA-256", "SHA-384", "SHA-512"] as const).map((a) => (
            <Card key={a}>
              <CardContent className="flex items-center gap-2 p-3">
                <Badge variant="outline" className="font-mono">
                  {a}
                </Badge>
                <code className="flex-1 truncate font-mono text-xs">{hashes[a] ?? "…"}</code>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7"
                  onClick={() => {
                    void navigator.clipboard.writeText(hashes[a] ?? "").then(() => toast.success("Copied"));
                  }}
                  aria-label="Copy"
                >
                  <Copy className="size-3" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

function JwtTool() {
  const [token, setToken] = useState(
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c",
  );
  const decoded = useMemo(() => T.decodeJwt(token), [token]);
  const result = decoded.ok ? decoded.parts : null;
  const err = decoded.ok ? null : decoded.error;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>JWT token</Label>
        <Textarea
          value={token}
          onChange={(e) => setToken(e.target.value)}
          className="min-h-[120px] font-mono text-xs"
          placeholder="header.payload.signature"
        />
        {err && (
          <Alert variant="destructive">
            <AlertDescription className="font-mono text-xs">{err}</AlertDescription>
          </Alert>
        )}
      </div>
      {result && (
        <div className="grid gap-3">
          <JwtSection title="Header" data={result.header} />
          <JwtSection title="Payload" data={result.payload} />
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Signature</CardTitle>
              <CardDescription>Cannot be verified without the secret</CardDescription>
            </CardHeader>
            <CardContent>
              <code className="bg-muted/50 block rounded p-2 font-mono text-xs break-all">
                {result.signature}
              </code>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function JwtSection({ title, data }: { title: string; data: Record<string, unknown> }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <pre className="bg-muted/50 overflow-auto rounded p-2 font-mono text-xs">
          {JSON.stringify(data, null, 2)}
        </pre>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────
// UUID / Color / Number base / Cron / Regex / Diff / Lorem / QR
// ─────────────────────────────────────────────────────────────────────

function UuidTool() {
  const [count, setCount] = useState(5);
  const [kind, setKind] = useState<"v1" | "v4" | "v7" | "nanoid" | "password">("v4");
  const [items, setItems] = useState<string[]>([]);
  const [pwLength, setPwLength] = useState(20);
  const [pwOpts, setPwOpts] = useState({ upper: true, lower: true, digits: true, symbols: true });

  const gen = () => {
    const out: string[] = [];
    for (let i = 0; i < count; i++) {
      switch (kind) {
        case "v1":
          out.push(T.uuidV1());
          break;
        case "v4":
          out.push(T.uuidV4());
          break;
        case "v7":
          out.push(T.uuidV7());
          break;
        case "nanoid":
          out.push(T.nanoId(21));
          break;
        case "password":
          out.push(T.randomPassword(pwLength, pwOpts));
          break;
      }
    }
    setItems(out);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label>Type</Label>
              <select
                className="border-input bg-background h-9 rounded-md border px-2 text-sm"
                value={kind}
                onChange={(e) => setKind(e.target.value as never)}
              >
                <option value="v1">UUID v1</option>
                <option value="v4">UUID v4</option>
                <option value="v7">UUID v7</option>
                <option value="nanoid">Nano ID</option>
                <option value="password">Random password</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label>Count</Label>
              <Input
                type="number"
                min={1}
                max={100}
                value={count}
                onChange={(e) => setCount(Number(e.target.value) || 1)}
                className="h-9 w-20"
              />
            </div>
            {kind === "password" && (
              <>
                <div className="space-y-1">
                  <Label>Length</Label>
                  <Input
                    type="number"
                    min={6}
                    max={128}
                    value={pwLength}
                    onChange={(e) => setPwLength(Number(e.target.value) || 16)}
                    className="h-9 w-20"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Charset</Label>
                  <div className="flex gap-2 text-xs">
                    {(["upper", "lower", "digits", "symbols"] as const).map((k) => (
                      <label key={k} className="flex items-center gap-1">
                        <input
                          type="checkbox"
                          checked={pwOpts[k]}
                          onChange={(e) => setPwOpts((o) => ({ ...o, [k]: e.target.checked }))}
                        />
                        {k}
                      </label>
                    ))}
                  </div>
                </div>
              </>
            )}
            <Button onClick={gen}>
              <RefreshCw className="mr-1.5 size-3.5" /> Generate
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                void navigator.clipboard.writeText(items.join("\n")).then(() => toast.success("Copied all"));
              }}
              disabled={items.length === 0}
            >
              <Copy className="mr-1.5 size-3.5" /> Copy all
            </Button>
          </div>
        </CardContent>
      </Card>
      <div className="space-y-1.5">
        {items.map((it, i) => (
          <Card key={i}>
            <CardContent className="flex items-center gap-2 p-2">
              <code className="flex-1 truncate font-mono text-xs">{it}</code>
              <Button
                size="icon"
                variant="ghost"
                className="size-7"
                onClick={() => {
                  void navigator.clipboard.writeText(it).then(() => toast.success("Copied"));
                }}
                aria-label="Copy"
              >
                <Copy className="size-3" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function ColorTool() {
  const [hex, setHex] = useState("#3B82F6");
  const rgb = useMemo(() => T.parseHex(hex), [hex]);
  const hsl = useMemo(() => (rgb ? T.rgbToHsl(rgb) : null), [rgb]);
  const hsv = useMemo(() => (rgb ? T.rgbToHsv(rgb) : null), [rgb]);
  const cmyk = useMemo(() => (rgb ? T.rgbToCmyk(rgb) : null), [rgb]);

  const setFromHex = (h: string) => {
    if (/^#[0-9a-fA-F]{6}$/.test(h)) setHex(h);
    else if (/^[0-9a-fA-F]{6}$/.test(h)) setHex("#" + h);
  };
  const setFromRgb = (r: number, g: number, b: number) => setHex(T.rgbToHex({ r, g, b }));

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-col items-center gap-4 p-4 md:flex-row">
          <div className="border-border size-32 shrink-0 rounded-md border" style={{ background: hex }} />
          <div className="flex-1 space-y-3">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Field label="HEX" value={hex} onChange={setFromHex} mono />
              {rgb && (
                <>
                  <Field
                    label="R"
                    value={String(rgb.r)}
                    onChange={(v) => setFromRgb(Number(v) || 0, rgb.g, rgb.b)}
                    mono
                  />
                  <Field
                    label="G"
                    value={String(rgb.g)}
                    onChange={(v) => setFromRgb(rgb.r, Number(v) || 0, rgb.b)}
                    mono
                  />
                  <Field
                    label="B"
                    value={String(rgb.b)}
                    onChange={(v) => setFromRgb(rgb.r, rgb.g, Number(v) || 0)}
                    mono
                  />
                </>
              )}
              {hsl && (
                <>
                  <Field label="H°" value={String(hsl.h)} onChange={() => undefined} mono readOnly />
                  <Field label="S%" value={String(hsl.s)} onChange={() => undefined} mono readOnly />
                  <Field label="L%" value={String(hsl.l)} onChange={() => undefined} mono readOnly />
                </>
              )}
              {hsv && (
                <>
                  <Field label="V%" value={String(hsv.v)} onChange={() => undefined} mono readOnly />
                </>
              )}
              {cmyk && (
                <>
                  <Field label="C%" value={String(cmyk.c)} onChange={() => undefined} mono readOnly />
                  <Field label="M%" value={String(cmyk.m)} onChange={() => undefined} mono readOnly />
                  <Field label="Y%" value={String(cmyk.y)} onChange={() => undefined} mono readOnly />
                  <Field label="K%" value={String(cmyk.k)} onChange={() => undefined} mono readOnly />
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  mono,
  readOnly,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  mono?: boolean;
  readOnly?: boolean;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        readOnly={readOnly}
        className={`h-8 text-xs ${mono ? "font-mono" : ""}`}
      />
    </div>
  );
}

function NumberBaseTool() {
  const [value, setValue] = useState("42");
  const [from, setFrom] = useState(10);
  const [to, setTo] = useState(16);
  const converted = useMemo(() => T.convertBase(value, from, to), [value, from, to]);
  const out = converted.ok ? converted.output : "";
  const err = converted.ok ? null : converted.error;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="space-y-1">
              <Label>Value</Label>
              <Input value={value} onChange={(e) => setValue(e.target.value)} className="h-9 font-mono" />
            </div>
            <div className="space-y-1">
              <Label>From base</Label>
              <select
                className="border-input bg-background h-9 rounded-md border px-2 text-sm"
                value={from}
                onChange={(e) => setFrom(Number(e.target.value))}
              >
                {[2, 8, 10, 16].map((b) => (
                  <option key={b} value={b}>
                    Base {b}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>To base</Label>
              <select
                className="border-input bg-background h-9 rounded-md border px-2 text-sm"
                value={to}
                onChange={(e) => setTo(Number(e.target.value))}
              >
                {[2, 8, 10, 16].map((b) => (
                  <option key={b} value={b}>
                    Base {b}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <Label>Result</Label>
            <div className="bg-muted/30 mt-1 rounded-md border p-2 font-mono text-xs">{out || "—"}</div>
            {err && (
              <Alert variant="destructive" className="mt-2">
                <AlertDescription className="font-mono text-xs">{err}</AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function CronTool() {
  const [expr, setExpr] = useState("*/5 * * * *");
  const [count, setCount] = useState(5);
  const result = useMemo(() => T.parseCron(expr, count), [expr, count]);
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label>Cron expression</Label>
              <Input
                value={expr}
                onChange={(e) => setExpr(e.target.value)}
                className="h-9 font-mono"
                placeholder="*/5 * * * *"
              />
            </div>
            <div className="space-y-1">
              <Label>Show next</Label>
              <Input
                type="number"
                min={1}
                max={20}
                value={count}
                onChange={(e) => setCount(Number(e.target.value) || 1)}
                className="h-9 w-32"
              />
            </div>
          </div>
          {result && !result.ok && (
            <Alert variant="destructive">
              <AlertDescription className="font-mono text-xs">{result.error}</AlertDescription>
            </Alert>
          )}
          {result && result.ok && (
            <>
              <div className="text-muted-foreground text-xs">{result.description}</div>
              <div className="space-y-1">
                {result.nextRuns.map((d, i) => (
                  <div
                    key={i}
                    className="bg-muted/30 flex items-center justify-between rounded-md border p-2 font-mono text-xs"
                  >
                    <span>{d.toLocaleString()}</span>
                    <span className="text-muted-foreground">{d.toISOString()}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function RegexTool() {
  const [pattern, setPattern] = useState("\\b(\\w+)@([\\w.]+)\\b");
  const [flags, setFlags] = useState("g");
  const [text, setText] = useState("Email me at hello@docforge.dev or support@docforge.dev.");
  const result = useMemo(() => T.testRegex(pattern, flags, text), [pattern, flags, text]);

  const highlighted = useMemo(() => {
    if (!result || !result.ok) return null;
    const nodes: React.ReactNode[] = [];
    let cursor = 0;
    result.matches.forEach((m, i) => {
      if (m.index > cursor) nodes.push(<span key={`p${i}`}>{text.slice(cursor, m.index)}</span>);
      nodes.push(
        <mark key={`m${i}`} className="rounded bg-yellow-200 px-0.5 dark:bg-yellow-900/60">
          {m.match}
        </mark>,
      );
      cursor = m.index + m.length;
    });
    if (cursor < text.length) nodes.push(<span key="tail">{text.slice(cursor)}</span>);
    return nodes;
  }, [result, text]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-[1fr_120px]">
        <div className="space-y-1">
          <Label>Pattern</Label>
          <Input value={pattern} onChange={(e) => setPattern(e.target.value)} className="h-9 font-mono" />
        </div>
        <div className="space-y-1">
          <Label>Flags</Label>
          <Input value={flags} onChange={(e) => setFlags(e.target.value)} className="h-9 font-mono" />
        </div>
      </div>
      <div className="space-y-1">
        <Label>Test text</Label>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="min-h-[140px] font-mono text-xs"
        />
      </div>
      {result && !result.ok && (
        <Alert variant="destructive">
          <AlertDescription className="font-mono text-xs">{result.error}</AlertDescription>
        </Alert>
      )}
      {result && result.ok && (
        <Card>
          <CardContent className="p-3 text-xs">
            <div className="bg-muted/30 mb-2 rounded-md border p-2 font-mono">{highlighted}</div>
            <div className="text-muted-foreground">
              {result.matches.length} match{result.matches.length === 1 ? "" : "es"}
            </div>
            <div className="mt-2 space-y-1">
              {result.matches.map((m, i) => (
                <div key={i} className="bg-muted/30 flex flex-wrap gap-3 rounded-md border p-2 font-mono">
                  <span className="text-muted-foreground">
                    [{m.index}..{m.index + m.length}]
                  </span>
                  <span>{m.match}</span>
                  {Object.entries(m.groups).map(([k, v]) => (
                    <span key={k} className="text-blue-600 dark:text-blue-400">
                      {k}={v}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function DiffTool() {
  const [a, setA] = useState("the quick brown fox\njumps over the lazy dog\nhello world");
  const [b, setB] = useState("the quick brown cat\njumps over the lazy dog\ngoodbye world\nextra line");
  const diff = useMemo(() => T.diffLines(a, b), [a, b]);
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <Label>Original</Label>
          <Textarea
            value={a}
            onChange={(e) => setA(e.target.value)}
            className="min-h-[200px] font-mono text-xs"
          />
        </div>
        <div className="space-y-1">
          <Label>Modified</Label>
          <Textarea
            value={b}
            onChange={(e) => setB(e.target.value)}
            className="min-h-[200px] font-mono text-xs"
          />
        </div>
      </div>
      <Card>
        <CardContent className="p-0">
          <div className="font-mono text-xs">
            {diff.map((d, i) => (
              <div
                key={i}
                className={
                  d.kind === "added"
                    ? "bg-emerald-50 dark:bg-emerald-950/30"
                    : d.kind === "removed"
                      ? "bg-red-50 dark:bg-red-950/30"
                      : ""
                }
              >
                <span className="text-muted-foreground inline-block w-6 text-center select-none">
                  {d.kind === "added" ? "+" : d.kind === "removed" ? "-" : " "}
                </span>
                {d.kind === "added" ? d.right : (d.left ?? "")}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function LoremTool() {
  const [count, setCount] = useState(3);
  const [unit, setUnit] = useState<"paragraph" | "word">("paragraph");
  const [text, setText] = useState(() =>
    unit === "paragraph" ? T.loremParagraphs(count) : T.loremWords(count),
  );
  const gen = () => setText(unit === "paragraph" ? T.loremParagraphs(count) : T.loremWords(count));
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label>Count</Label>
              <Input
                type="number"
                min={1}
                max={50}
                value={count}
                onChange={(e) => setCount(Number(e.target.value) || 1)}
                className="h-9 w-20"
              />
            </div>
            <div className="space-y-1">
              <Label>Unit</Label>
              <select
                className="border-input bg-background h-9 rounded-md border px-2 text-sm"
                value={unit}
                onChange={(e) => setUnit(e.target.value as never)}
              >
                <option value="paragraph">Paragraphs</option>
                <option value="word">Words</option>
              </select>
            </div>
            <Button onClick={gen}>
              <RefreshCw className="mr-1.5 size-3.5" /> Generate
            </Button>
            <Button
              variant="outline"
              disabled={!text}
              onClick={() => {
                void navigator.clipboard.writeText(text).then(() => toast.success("Copied"));
              }}
            >
              <Copy className="mr-1.5 size-3.5" /> Copy
            </Button>
          </div>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="min-h-[260px] font-mono text-xs"
          />
        </CardContent>
      </Card>
    </div>
  );
}

function QrTool() {
  const [text, setText] = useState("https://github.com/badhope/OnlineCode");
  const [dataUrl, setDataUrl] = useState<string>("");
  useEffect(() => {
    let cancelled = false;
    T.generateQrCodeDataUrl(text, 256)
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [text]);
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-2">
        <Label>Text or URL</Label>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="min-h-[220px] font-mono text-xs"
        />
        <Button
          variant="outline"
          onClick={() => {
            void navigator.clipboard.writeText(dataUrl).then(() => toast.success("Data URL copied"));
          }}
          disabled={!dataUrl}
        >
          <Copy className="mr-1.5 size-3.5" /> Copy data URL
        </Button>
      </div>
      <div className="bg-muted/20 flex flex-col items-center justify-center gap-3 rounded-md border p-6">
        {dataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={dataUrl} alt="QR code" className="size-64 rounded-md bg-white p-2" />
        ) : (
          <p className="text-muted-foreground text-sm">Generating…</p>
        )}
        {dataUrl && (
          <Button asChild>
            <a href={dataUrl} download="qr.png">
              <Download className="mr-1.5 size-3.5" /> Download PNG
            </a>
          </Button>
        )}
      </div>
    </div>
  );
}
