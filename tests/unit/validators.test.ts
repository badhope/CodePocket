import { describe, it, expect } from "vitest";
import {
  createProjectSchema,
  createFileSchema,
  createSnippetSchema,
  executeSchema,
  signUpSchema,
} from "@/lib/validators";

describe("createProjectSchema", () => {
  it("accepts valid project", () => {
    const r = createProjectSchema.safeParse({
      name: "test",
      language: "python",
    });
    expect(r.success).toBe(true);
  });
  it("rejects too short name", () => {
    const r = createProjectSchema.safeParse({ name: "", language: "python" });
    expect(r.success).toBe(false);
  });
  it("rejects invalid language", () => {
    const r = createProjectSchema.safeParse({ name: "x", language: "made-up-lang" });
    expect(r.success).toBe(false);
  });
});

describe("createFileSchema", () => {
  it("requires projectId and path", () => {
    const r = createFileSchema.safeParse({ path: "main.py", projectId: "uuid" });
    expect(r.success).toBe(false);
    const r2 = createFileSchema.safeParse({
      projectId: "00000000-0000-0000-0000-000000000000",
      path: "main.py",
    });
    expect(r2.success).toBe(true);
  });
  it("rejects invalid type", () => {
    const r = createFileSchema.safeParse({
      projectId: "00000000-0000-0000-0000-000000000000",
      path: "x",
      type: "symbolic-link",
    });
    expect(r.success).toBe(false);
  });
});

describe("createSnippetSchema", () => {
  it("requires title, code, language", () => {
    const r = createSnippetSchema.safeParse({ title: "hi", code: "print(1)", language: "python" });
    expect(r.success).toBe(true);
  });
  it("rejects too long code", () => {
    const r = createSnippetSchema.safeParse({
      title: "x",
      code: "x".repeat(5_242_881),
      language: "python",
    });
    expect(r.success).toBe(false);
  });
});

describe("executeSchema", () => {
  it("requires language and files", () => {
    const r = executeSchema.safeParse({});
    expect(r.success).toBe(false);
  });
  it("accepts minimal request", () => {
    const r = executeSchema.safeParse({
      language: "python",
      files: [{ name: "main.py", content: "print(1)" }],
    });
    expect(r.success).toBe(true);
  });
});

describe("signUpSchema", () => {
  it("requires email and strong password", () => {
    const r = signUpSchema.safeParse({ name: "Alice", email: "a@b.com", password: "short" });
    expect(r.success).toBe(false);
    const r2 = signUpSchema.safeParse({
      name: "Alice",
      email: "a@b.com",
      password: "Strong1Pass",
    });
    expect(r2.success).toBe(true);
  });
});
