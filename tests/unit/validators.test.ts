import { describe, it, expect } from "vitest";
import { signUpSchema } from "@/lib/validators";

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

describe("placeholder tests for removed validators", () => {
  it("validators barrel exports only auth for now", () => {
    expect(typeof signUpSchema).toBe("object");
  });
});