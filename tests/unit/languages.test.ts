import { describe, it, expect } from "vitest";
import { LANGUAGES, getLanguage, LANGUAGE_LIST, languageIdSchema } from "@/lib/execution";

describe("execution/languages", () => {
  it("exports LANGUAGES map", () => {
    expect(Object.keys(LANGUAGES).length).toBeGreaterThan(10);
  });
  it("exports LANGUAGE_LIST array", () => {
    expect(Array.isArray(LANGUAGE_LIST)).toBe(true);
    expect(LANGUAGE_LIST.length).toBe(Object.keys(LANGUAGES).length);
  });
  it("getLanguage returns metadata for valid id", () => {
    const py = getLanguage("python");
    expect(py).toBeDefined();
    expect(py?.label).toBe("Python");
  });
  it("getLanguage returns null for invalid id", () => {
    expect(getLanguage("not-a-language")).toBeNull();
  });
  it("languageIdSchema validates correctly", () => {
    expect(languageIdSchema.safeParse("python").success).toBe(true);
    expect(languageIdSchema.safeParse("bad-lang").success).toBe(false);
  });
  it("every language has monaco language and piston version", () => {
    for (const l of LANGUAGE_LIST) {
      expect(l.monacoLanguage).toBeTruthy();
      expect(l.defaultVersion).toBeTruthy();
      expect(l.extensions.length).toBeGreaterThan(0);
    }
  });
});
