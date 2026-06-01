import { describe, it, expect } from "vitest";
import {
  APP_NAME,
  APP_VERSION,
  SUPPORTED_LOCALES,
  SUPPORTED_LANGUAGES,
  DEFAULT_LOCALE,
  FREE_TIER_LIMITS,
  PRO_TIER_LIMITS,
  ADMIN_TIER_LIMITS,
  PROJECT_VISIBILITY,
  FILE_LIMITS,
  SHARE_TTL_OPTIONS,
} from "@/lib/constants";

describe("app constants", () => {
  it("APP_NAME and APP_VERSION are set", () => {
    expect(APP_NAME).toBe("OnlineCode");
    expect(APP_VERSION.length).toBeGreaterThan(0);
  });
});

describe("locales", () => {
  it("has 6 supported locales", () => {
    expect(SUPPORTED_LOCALES.length).toBe(6);
  });

  it("DEFAULT_LOCALE is in SUPPORTED_LOCALES", () => {
    expect((SUPPORTED_LOCALES as readonly string[]).includes(DEFAULT_LOCALE)).toBe(true);
  });

  it("all locales are non-empty strings", () => {
    for (const loc of SUPPORTED_LOCALES) {
      expect(loc.length).toBeGreaterThan(0);
    }
  });
});

describe("languages", () => {
  it("has 19 supported languages", () => {
    expect(SUPPORTED_LANGUAGES.length).toBe(19);
  });

  it("no duplicate languages", () => {
    const set = new Set(SUPPORTED_LANGUAGES);
    expect(set.size).toBe(SUPPORTED_LANGUAGES.length);
  });
});

describe("tier limits", () => {
  it("PRO limits exceed FREE limits", () => {
    expect(PRO_TIER_LIMITS.projects).toBeGreaterThan(FREE_TIER_LIMITS.projects);
    expect(PRO_TIER_LIMITS.executionsPerHour).toBeGreaterThan(FREE_TIER_LIMITS.executionsPerHour);
    expect(PRO_TIER_LIMITS.storageMB).toBeGreaterThan(FREE_TIER_LIMITS.storageMB);
  });

  it("ADMIN limits are unlimited", () => {
    expect(ADMIN_TIER_LIMITS.projects).toBe(Infinity);
    expect(ADMIN_TIER_LIMITS.filesPerProject).toBe(Infinity);
    expect(ADMIN_TIER_LIMITS.executionsPerHour).toBe(Infinity);
  });
});

describe("project visibility", () => {
  it("has three visibility levels", () => {
    expect(PROJECT_VISIBILITY.PRIVATE).toBe("private");
    expect(PROJECT_VISIBILITY.PUBLIC).toBe("public");
    expect(PROJECT_VISIBILITY.UNLISTED).toBe("unlisted");
  });
});

describe("file limits", () => {
  it("maxFileSizeMB is 5", () => {
    expect(FILE_LIMITS.maxFileSizeMB).toBe(5);
  });
  it("maxFileNameLength is 255", () => {
    expect(FILE_LIMITS.maxFileNameLength).toBe(255);
  });
});

describe("share TTL options", () => {
  it("has 5 options", () => {
    expect(SHARE_TTL_OPTIONS.length).toBe(5);
  });

  it("Never has value 0", () => {
    const never = SHARE_TTL_OPTIONS.find((o) => o.label === "Never");
    expect(never?.value).toBe(0);
  });

  it("values are in ascending order (1h < 1d < 7d < 30d < Never)", () => {
    const values = SHARE_TTL_OPTIONS.map((o) => o.value);
    for (let i = 1; i < values.length - 1; i++) {
      expect(values[i]!).toBeGreaterThan(values[i - 1]!);
    }
  });
});
