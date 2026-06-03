import { describe, it, expect } from "vitest";
import {
  APP_NAME,
  APP_VERSION,
  SUPPORTED_LOCALES,
  DEFAULT_LOCALE,
  FREE_TIER_LIMITS,
  PRO_TIER_LIMITS,
  ADMIN_TIER_LIMITS,
  MAX_FILE_SIZE_MB,
  MAX_FILES_PER_UPLOAD,
  ROLES,
  CONVERSION_STATUS,
} from "@/lib/constants";

describe("app constants", () => {
  it("APP_NAME and APP_VERSION are set", () => {
    expect(APP_NAME).toBe("DocForge");
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

describe("tier limits", () => {
  it("PRO limits exceed FREE limits", () => {
    expect(PRO_TIER_LIMITS.conversionsPerDay).toBeGreaterThan(FREE_TIER_LIMITS.conversionsPerDay);
    expect(PRO_TIER_LIMITS.maxFileSizeMB).toBeGreaterThan(FREE_TIER_LIMITS.maxFileSizeMB);
    expect(PRO_TIER_LIMITS.storageMB).toBeGreaterThan(FREE_TIER_LIMITS.storageMB);
  });

  it("ADMIN limits exceed PRO limits", () => {
    expect(ADMIN_TIER_LIMITS.conversionsPerDay).toBe(Infinity);
    expect(ADMIN_TIER_LIMITS.maxFileSizeMB).toBeGreaterThan(PRO_TIER_LIMITS.maxFileSizeMB);
    expect(ADMIN_TIER_LIMITS.storageMB).toBeGreaterThan(PRO_TIER_LIMITS.storageMB);
  });
});

describe("file limits", () => {
  it("MAX_FILE_SIZE_MB is 50", () => {
    expect(MAX_FILE_SIZE_MB).toBe(50);
  });
  it("MAX_FILES_PER_UPLOAD is 10", () => {
    expect(MAX_FILES_PER_UPLOAD).toBe(10);
  });
});

describe("roles", () => {
  it("has three roles", () => {
    expect(ROLES.USER).toBe("user");
    expect(ROLES.PRO).toBe("pro");
    expect(ROLES.ADMIN).toBe("admin");
  });
});

describe("conversion status", () => {
  it("has four statuses", () => {
    expect(CONVERSION_STATUS.PENDING).toBe("pending");
    expect(CONVERSION_STATUS.PROCESSING).toBe("processing");
    expect(CONVERSION_STATUS.COMPLETED).toBe("completed");
    expect(CONVERSION_STATUS.FAILED).toBe("failed");
  });
});