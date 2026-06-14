/**
 * 时间工具 — 框架无关。
 * epoch / ISO / 相对时间（i18n 文案由各 app 提供）。
 */

export type TimeUnit = "ms" | "s" | "min" | "h" | "d" | "w" | "mo" | "y";

/** 毫秒 → 秒 / 分 / 时 / 天 */
export function msToUnit(ms: number, unit: TimeUnit): number {
  switch (unit) {
    case "ms":
      return ms;
    case "s":
      return ms / 1000;
    case "min":
      return ms / 60_000;
    case "h":
      return ms / 3_600_000;
    case "d":
      return ms / 86_400_000;
    case "w":
      return ms / (7 * 86_400_000);
    case "mo":
      return ms / (30 * 86_400_000);
    case "y":
      return ms / (365 * 86_400_000);
  }
}

export function epochToIso(epochSec: number): string {
  return new Date(epochSec * 1000).toISOString();
}

export function isoToEpoch(iso: string): number {
  return Math.floor(new Date(iso).getTime() / 1000);
}

export function nowEpochSec(): number {
  return Math.floor(Date.now() / 1000);
}

/** 相对时间（"3 分钟前"）— 文案由 caller 提供（i18n） */
export interface RelativeTime {
  value: number;
  unit: TimeUnit;
  /** 是否未来时间 */
  future: boolean;
}

export function relativeTime(iso: string, nowMs = Date.now()): RelativeTime {
  const target = new Date(iso).getTime();
  const diff = target - nowMs;
  const future = diff > 0;
  const abs = Math.abs(diff);
  const units: { unit: TimeUnit; ms: number }[] = [
    { unit: "y", ms: 365 * 86_400_000 },
    { unit: "mo", ms: 30 * 86_400_000 },
    { unit: "w", ms: 7 * 86_400_000 },
    { unit: "d", ms: 86_400_000 },
    { unit: "h", ms: 3_600_000 },
    { unit: "min", ms: 60_000 },
    { unit: "s", ms: 1000 },
  ];
  for (const { unit, ms } of units) {
    if (abs >= ms) {
      return { value: Math.floor(abs / ms), unit, future };
    }
  }
  return { value: 0, unit: "s", future };
}
