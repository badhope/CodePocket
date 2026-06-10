import { describe, it, expect } from "vitest";
import { DEFAULT_LIMITS, PRO_LIMITS } from "@/lib/execution/protocol";
import { LANGUAGES, getLanguage, LANGUAGE_LIST } from "@/lib/execution";

describe("execution limits", () => {
  it("DEFAULT_LIMITS has all required fields", () => {
    expect(DEFAULT_LIMITS.cpuTimeMs).toBe(10_000);
    expect(DEFAULT_LIMITS.memoryMB).toBe(256);
    expect(DEFAULT_LIMITS.diskMB).toBe(100);
    expect(DEFAULT_LIMITS.processes).toBe(32);
  });

  it("PRO_LIMITS are higher than DEFAULT_LIMITS", () => {
    expect(PRO_LIMITS.cpuTimeMs).toBeGreaterThan(DEFAULT_LIMITS.cpuTimeMs);
    expect(PRO_LIMITS.memoryMB).toBeGreaterThan(DEFAULT_LIMITS.memoryMB);
    expect(PRO_LIMITS.processes).toBeGreaterThan(DEFAULT_LIMITS.processes);
  });
});

describe("language registry integrity", () => {
  const requiredFields = [
    "id",
    "label",
    "monacoLanguage",
    "pistonLanguage",
    "defaultVersion",
    "extensions",
    "icon",
    "runCommand",
    "defaultCode",
    "compiled",
    "category",
  ] as const;

  it("every language has all required metadata fields", () => {
    for (const lang of LANGUAGE_LIST) {
      for (const field of requiredFields) {
        expect(lang[field], `${lang.id} missing ${field}`).toBeDefined();
      }
    }
  });

  it("all languages have defaultCode that is not empty", () => {
    for (const lang of LANGUAGE_LIST) {
      expect(lang.defaultCode.length, `${lang.id} has no defaultCode`).toBeGreaterThan(0);
    }
  });

  it("compiled languages have compileCommand", () => {
    const compiled = LANGUAGE_LIST.filter((l) => l.compiled);
    for (const lang of compiled) {
      expect(lang.compileCommand, `${lang.id} compiled but no compileCommand`).toBeTruthy();
    }
  });

  it("LANGUAGE_LIST and LANGUAGES map are consistent", () => {
    for (const lang of LANGUAGE_LIST) {
      expect(LANGUAGES[lang.id]).toBeDefined();
      expect(LANGUAGES[lang.id].id).toBe(lang.id);
    }
    expect(Object.keys(LANGUAGES).length).toBe(LANGUAGE_LIST.length);
  });

  it("category values are from a known set", () => {
    const validCategories = ["scripting", "compiled", "jvm", "dotnet", "data", "markup", "shell"];
    for (const lang of LANGUAGE_LIST) {
      expect(validCategories, `${lang.id} has invalid category ${lang.category}`).toContain(lang.category);
    }
  });

  it("getLanguage is case-sensitive exact match", () => {
    expect(getLanguage("Python")).toBeNull();
    expect(getLanguage("PYTHON")).toBeNull();
    expect(getLanguage("python")).not.toBeNull();
  });

  it("all extensions start with dot", () => {
    for (const lang of LANGUAGE_LIST) {
      for (const ext of lang.extensions) {
        expect(ext.startsWith("."), `${lang.id} extension ${ext}`).toBe(true);
      }
    }
  });
});

describe("specific language checks", () => {
  it("Python has correct config", () => {
    const py = getLanguage("python")!;
    expect(py.monacoLanguage).toBe("python");
    expect(py.pistonLanguage).toBe("python");
    expect(py.runCommand).toContain("python3");
    expect(py.compiled).toBe(false);
    expect(py.category).toBe("scripting");
  });

  it("C++ has compile command", () => {
    const cpp = getLanguage("cpp")!;
    expect(cpp.compiled).toBe(true);
    expect(cpp.compileCommand).toContain("g++");
    expect(cpp.runCommand).toContain(".out");
  });

  it("JavaScript and TypeScript are scripting", () => {
    expect(getLanguage("javascript")!.compiled).toBe(false);
    expect(getLanguage("typescript")!.compiled).toBe(true);
  });

  it("Bash, Lua, SQL are non-compiled", () => {
    for (const id of ["bash", "lua", "sql"] as const) {
      expect(getLanguage(id)!.compiled).toBe(false);
    }
  });
});
