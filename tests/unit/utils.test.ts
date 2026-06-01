import { describe, it, expect } from "vitest";
import {
  cn,
  formatBytes,
  formatDuration,
  debounce,
  truncate,
  slugify,
  isClient,
  isServer,
} from "@/lib/utils";

describe("cn", () => {
  it("merges class names", () => {
    expect(cn("a", "b")).toBe("a b");
    expect(cn("a", false && "b", "c")).toBe("a c");
  });
  it("dedupes tailwind classes", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
  });
});

describe("formatBytes", () => {
  it("formats bytes correctly", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1024)).toBe("1 KB");
    expect(formatBytes(1024 * 1024)).toBe("1 MB");
    expect(formatBytes(1024 * 1024 * 1024)).toBe("1 GB");
  });
});

describe("formatDuration", () => {
  it("formats ms", () => {
    expect(formatDuration(500)).toBe("500ms");
  });
  it("formats seconds", () => {
    expect(formatDuration(1500)).toBe("1.50s");
  });
  it("formats minutes", () => {
    expect(formatDuration(65_000)).toBe("1m 5s");
  });
});

describe("debounce", () => {
  it("only calls after delay", async () => {
    let n = 0;
    const inc = () => n++;
    const d = debounce(inc, 30);
    d();
    d();
    d();
    await new Promise((r) => setTimeout(r, 50));
    expect(n).toBe(1);
  });
});

describe("truncate", () => {
  it("truncates strings", () => {
    expect(truncate("hello world", 8)).toBe("hello w…");
    expect(truncate("short", 10)).toBe("short");
  });
});

describe("slugify", () => {
  it("creates slugs", () => {
    expect(slugify("Hello World")).toBe("hello-world");
    expect(slugify("foo_bar 123")).toBe("foo-bar-123");
  });
});

describe("env helpers", () => {
  it("report current environment", () => {
    expect([true, false]).toContain(isServer);
    expect([true, false]).toContain(isClient);
    expect(isServer).not.toBe(isClient);
  });
});
