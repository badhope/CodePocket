import { createHash } from "node:crypto"
import { CACHE_MAX_ENTRIES, type ConversionOptions } from "./types"

interface CacheEntry {
  outputBuffer: Buffer
  mimeType: string
  outputFilename: string
  outputFormat: string
  timestamp: number
}

export interface CacheStats {
  hits: number
  misses: number
  evictions: number
  size: number
  maxSize: number
  hitRate: number
  memoryBytes: number
  memoryMb: number
}

/**
 * Stable, content-addressed cache key. Combines a SHA-256 of the input
 * buffer (truncated to 64 hex chars for readability) with a stable JSON
 * representation of the conversion options so that two callers asking
 * for the same logical conversion collide.
 */
export function getCacheKey(buffer: Buffer, options: ConversionOptions): string {
  const hasher = createHash("sha256")
  hasher.update(buffer)
  hasher.update("|")
  hasher.update(
    JSON.stringify({
      inputFormat: options.inputFormat,
      outputFormat: options.outputFormat,
      filename: options.filename,
    }),
  )
  return hasher.digest("hex")
}

/**
 * Bounded LRU cache for conversion results. Backed by a `Map` whose
 * iteration order is insertion order — re-inserting on a hit keeps the
 * entry at the back of the map and naturally evicts the oldest key at
 * the front when we exceed the configured capacity.
 *
 * JavaScript is single-threaded, so a single shared `Map` is already
 * race-free; we additionally expose a `getInstance()` singleton to give
 * the rest of the engine a single, well-known cache to share.
 */
export class ConversionCache {
  private static instance: ConversionCache | null = null

  private readonly cache = new Map<string, CacheEntry>()
  private hits = 0
  private misses = 0
  private evictions = 0
  private memoryBytes = 0
  private readonly maxSize: number

  constructor(maxSize: number = CACHE_MAX_ENTRIES) {
    this.maxSize = Math.max(1, maxSize)
  }

  /**
   * Returns the process-wide cache instance, lazily creating it on first
   * access. Use this in production code paths so the cache is shared
   * between the API route handlers.
   */
  static getInstance(maxSize: number = CACHE_MAX_ENTRIES): ConversionCache {
    if (!ConversionCache.instance) {
      ConversionCache.instance = new ConversionCache(maxSize)
    }
    return ConversionCache.instance
  }

  /**
   * Reset the singleton — primarily useful in tests.
   */
  static resetInstance(): void {
    ConversionCache.instance = null
  }

  get size(): number {
    return this.cache.size
  }

  get maxEntries(): number {
    return this.maxSize
  }

  get stats(): CacheStats {
    const total = this.hits + this.misses
    return {
      hits: this.hits,
      misses: this.misses,
      evictions: this.evictions,
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: total === 0 ? 0 : this.hits / total,
      memoryBytes: this.memoryBytes,
      memoryMb: Math.round((this.memoryBytes / (1024 * 1024)) * 100) / 100,
    }
  }

  private keyFor(buffer: Buffer, options: ConversionOptions): string {
    return getCacheKey(buffer, options)
  }

  get(buffer: Buffer, options: ConversionOptions): CacheEntry | null {
    const key = this.keyFor(buffer, options)
    const entry = this.cache.get(key)
    if (!entry) {
      this.misses++
      return null
    }
    // Refresh recency — Map preserves insertion order, so re-inserting
    // moves the entry to the back of the iteration order.
    this.cache.delete(key)
    this.cache.set(key, entry)
    this.hits++
    return entry
  }

  set(buffer: Buffer, options: ConversionOptions, entry: Omit<CacheEntry, "timestamp">): void {
    const key = this.keyFor(buffer, options)
    if (this.cache.has(key)) {
      const old = this.cache.get(key)!
      this.memoryBytes -= estimateEntryBytes(old)
      this.cache.delete(key)
    } else if (this.cache.size >= this.maxSize) {
      const oldest = this.cache.keys().next()
      if (!oldest.done && oldest.value !== undefined) {
        const evicted = this.cache.get(oldest.value)
        if (evicted) this.memoryBytes -= estimateEntryBytes(evicted)
        this.cache.delete(oldest.value)
        this.evictions++
      }
    }
    const fullEntry: CacheEntry = { ...entry, timestamp: Date.now() }
    this.cache.set(key, fullEntry)
    this.memoryBytes += estimateEntryBytes(fullEntry)
  }

  has(buffer: Buffer, options: ConversionOptions): boolean {
    return this.cache.has(this.keyFor(buffer, options))
  }

  delete(buffer: Buffer, options: ConversionOptions): boolean {
    const existed = this.cache.delete(this.keyFor(buffer, options))
    return existed
  }

  clear(): void {
    this.cache.clear()
    this.hits = 0
    this.misses = 0
    this.evictions = 0
    this.memoryBytes = 0
  }
}

/**
 * Approximate memory footprint of a single cache entry. We account for
 * the output buffer (the dominant cost) plus a fixed overhead per entry
 * for the key string, metadata, and Map node overhead. Numbers are
 * intentionally generous so the reported figure slightly overstates
 * real usage, which is the safe direction for an observability signal.
 */
function estimateEntryBytes(entry: CacheEntry): number {
  return (
    entry.outputBuffer.byteLength +
    entry.outputFilename.length * 2 +
    entry.mimeType.length * 2 +
    entry.outputFormat.length * 2 +
    8 + // timestamp
    256 // Map node + key overhead
  )
}
