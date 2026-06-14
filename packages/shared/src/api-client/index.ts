/**
 * API 客户端 — 前端调用后端的封装
 */

export const ENDPOINTS = {
  health: "/api/health",
  execute: "/api/execute",
  executeStream: "/api/execute/stream",
  convert: "/api/convert",
} as const;

export interface ApiClientOptions {
  baseURL?: string;
  /** fetch 实现；默认 globalThis.fetch */
  fetch?: typeof globalThis.fetch;
  /** 自定义 header */
  headers?: Record<string, string>;
}

export interface RequestOptions {
  method?: string;
  body?: unknown;
  signal?: AbortSignal;
  timeoutMs?: number;
  raw?: boolean;
}

export class ApiClient {
  private readonly baseURL: string;
  private readonly fetchImpl: typeof globalThis.fetch;
  private readonly headers: Record<string, string>;

  constructor(opts: ApiClientOptions = {}) {
    this.baseURL = opts.baseURL ?? "";
    this.fetchImpl = opts.fetch ?? globalThis.fetch.bind(globalThis);
    this.headers = opts.headers ?? {};
  }

  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const url = `${this.baseURL}${path}`;
    const init: RequestInit = {
      method: options.method ?? "GET",
      headers: { "Content-Type": "application/json", ...this.headers },
      signal: options.signal,
    };
    if (options.body !== undefined) {
      init.body = JSON.stringify(options.body);
    }

    const res = await this.fetchImpl(url, init);
    if (options.raw) return res as unknown as T;
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
    }
    return (await res.json()) as T;
  }

  async post<T>(
    path: string,
    body: unknown,
    options?: { signal?: AbortSignal; timeoutMs?: number },
  ): Promise<T> {
    return this.request<T>(path, {
      method: "POST",
      body,
      signal: options?.signal,
      timeoutMs: options?.timeoutMs,
    });
  }
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`http://localhost:3000${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`http://localhost:3000${path}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}
