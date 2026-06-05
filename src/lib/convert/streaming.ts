import { Readable } from "node:stream"

export type BufferStreamEvent = "data" | "end" | "error" | "close" | "readable"

type DataListener = (chunk: Buffer) => void
type EndListener = () => void
type ErrorListener = (err: Error) => void
type AnyListener = DataListener | EndListener | ErrorListener

/**
 * A minimal, in-memory Readable-like wrapper around a `Buffer`. It does
 * not depend on Node.js stream internals and is safe to consume from
 * `for await ... of`, async iterators, or by registering listeners. The
 * intent is to allow the engine to feed a conversion function with a
 * stream-like interface without paying the cost of creating a real
 * `Readable` for every call.
 */
export class BufferStream {
  private buffer: Buffer
  private position = 0
  private ended = false
  private readonly dataListeners = new Set<DataListener>()
  private readonly endListeners = new Set<EndListener>()
  private readonly errorListeners = new Set<ErrorListener>()

  constructor(buffer: Buffer) {
    this.buffer = buffer
  }

  /** Total length of the underlying buffer. */
  get length(): number {
    return this.buffer.length
  }

  /** Number of bytes already read. */
  get bytesRead(): number {
    return this.position
  }

  /** True when every byte has been consumed. */
  get isEnded(): boolean {
    return this.ended
  }

  on(event: "data", listener: DataListener): this
  on(event: "end", listener: EndListener): this
  on(event: "error", listener: ErrorListener): this
  on(event: BufferStreamEvent, listener: AnyListener): this {
    if (event === "data") {
      this.dataListeners.add(listener as DataListener)
    } else if (event === "end") {
      this.endListeners.add(listener as EndListener)
    } else if (event === "error") {
      this.errorListeners.add(listener as ErrorListener)
    }
    return this
  }

  off(event: "data", listener: DataListener): this
  off(event: "end", listener: EndListener): this
  off(event: "error", listener: ErrorListener): this
  off(event: BufferStreamEvent, listener: AnyListener): this {
    if (event === "data") {
      this.dataListeners.delete(listener as DataListener)
    } else if (event === "end") {
      this.endListeners.delete(listener as EndListener)
    } else if (event === "error") {
      this.errorListeners.delete(listener as ErrorListener)
    }
    return this
  }

  /**
   * Read up to `size` bytes. Returns `null` once the stream is exhausted
   * and fires the `end` event on the first call that returns null.
   */
  read(size?: number): Buffer | null {
    if (this.ended) return null
    if (this.position >= this.buffer.length) {
      this.end()
      return null
    }
    const end =
      size !== undefined ? Math.min(this.position + size, this.buffer.length) : this.buffer.length
    const chunk = this.buffer.subarray(this.position, end)
    this.position = end
    for (const fn of this.dataListeners) fn(chunk)
    if (this.position >= this.buffer.length) {
      this.end()
    }
    return chunk
  }

  /**
   * Drain the entire stream into an array of chunks of at most
   * `chunkSize` bytes. Useful when callers want to iterate over a large
   * payload without materializing a single concatenated buffer.
   */
  toChunks(chunkSize: number = 64 * 1024): Buffer[] {
    const chunks: Buffer[] = []
    while (true) {
      const chunk = this.read(chunkSize)
      if (chunk === null) break
      chunks.push(chunk)
    }
    return chunks
  }

  /** Convert this stream into a real Node.js Readable. */
  toNodeStream(): Readable {
    return Readable.from(this.toChunks())
  }

  private end(): void {
    if (this.ended) return
    this.ended = true
    for (const fn of this.endListeners) fn()
  }

  /** Async iterator so the stream can be used with `for await`. */
  [Symbol.asyncIterator](): AsyncIterator<Buffer> {
    return {
      next: async (_value?: unknown): Promise<IteratorResult<Buffer>> => {
        const chunk = this.read(64 * 1024)
        if (chunk === null) {
          return Promise.resolve({ value: undefined as unknown as Buffer, done: true })
        }
        return Promise.resolve({ value: chunk, done: false })
      },
    }
  }
}

/**
 * Materialize a `Readable` (or any async iterable of `Buffer`-like
 * chunks) into a single `Buffer`. The chunks are accumulated into a
 * single allocation only at the end so we avoid quadratic string
 * concatenation. `highWaterMark` is honoured by Readable automatically.
 */
export async function streamToBuffer(stream: Readable | AsyncIterable<unknown>): Promise<Buffer> {
  const parts: Buffer[] = []
  let total = 0
  for await (const chunk of stream as AsyncIterable<unknown>) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as ArrayBufferLike)
    parts.push(buf)
    total += buf.length
  }
  return total === 0 ? Buffer.alloc(0) : Buffer.concat(parts, total)
}

export interface ChunkProcessOptions {
  /**
   * Maximum number of tasks running in parallel. Defaults to 3.
   * Values <= 1 collapse to serial execution.
   */
  concurrency?: number
  /**
   * Optional progress hook. Receives the number of completed tasks and
   * the total number of tasks.
   */
  onProgress?: (completed: number, total: number) => void
  /**
   * Optional signal to abort the batch. When aborted, in-flight tasks
   * are allowed to settle but no new tasks are scheduled.
   */
  signal?: AbortSignal
}

/**
 * Run `fn` over `items` with a bounded number of concurrent workers.
 * Results are returned in input order. If `signal` is aborted, remaining
 * items resolve to `undefined` and `onProgress` is not called again.
 */
export async function chunkProcess<T, R>(
  items: readonly T[],
  fn: (item: T, index: number) => Promise<R>,
  options: ChunkProcessOptions = {},
): Promise<R[]> {
  const total = items.length
  if (total === 0) return []

  const concurrency = Math.max(1, options.concurrency ?? 3)
  const results: R[] = new Array(total)
  let cursor = 0
  let completed = 0
  const { onProgress, signal } = options

  async function worker(): Promise<void> {
    while (true) {
      if (signal?.aborted) return
      const index = cursor++
      if (index >= total) return
      try {
        results[index] = await fn(items[index] as T, index)
      } finally {
        completed++
        if (onProgress) {
          try {
            onProgress(completed, total)
          } catch {
            /* swallow listener errors so the pipeline keeps moving */
          }
        }
      }
    }
  }

  const workerCount = Math.min(concurrency, total)
  const workers: Promise<void>[] = []
  for (let i = 0; i < workerCount; i++) {
    workers.push(worker())
  }
  await Promise.all(workers)
  return results
}
