/**
 * 取消工具 — AbortSignal 感知。
 * - `throwIfAborted(signal)` — 在耗时操作前主动检查
 * - `withAbort(signal, fn)` — 把 fetch / reader 包成可中断
 * - `linkAbort(parent, child)` — 任一信号触发则两者都触发
 */

export class AbortError extends Error {
  override readonly name = "AbortError";
  constructor(message = "aborted") {
    super(message);
  }
}

/** 在长循环里周期性检查 signal */
export function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new AbortError(signal.reason ?? "aborted");
  }
}

/** 把一个异步迭代器绑到 signal：signal 触发时停止迭代 */
export async function* withAbort<T>(
  source: AsyncIterable<T>,
  signal?: AbortSignal,
): AsyncIterable<T> {
  if (signal?.aborted) throw new AbortError();
  const it = source[Symbol.asyncIterator]();
  const abortHandler = () => {
    // 不需要 return；next() 调出 promise reject
    void it.return?.();
  };
  signal?.addEventListener("abort", abortHandler, { once: true });
  try {
    while (true) {
      if (signal?.aborted) throw new AbortError();
      const next = await it.next();
      if (next.done) return;
      yield next.value;
    }
  } finally {
    signal?.removeEventListener("abort", abortHandler);
  }
}

/** 链两个 AbortController：任一触发则两个都 abort */
export function linkAbort(parent: AbortSignal, child: AbortController): AbortController {
  const onAbort = () => {
    if (!child.signal.aborted) child.abort(parent.reason);
  };
  if (parent.aborted) onAbort();
  else parent.addEventListener("abort", onAbort, { once: true });
  return child;
}

/** 延时（ms），signal 触发立即 reject */
export function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new AbortError());
    const t = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(t);
      reject(new AbortError());
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}
