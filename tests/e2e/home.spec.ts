import { test, expect } from "@playwright/test";

test.describe("home page", () => {
  test("renders hero and languages grid", async ({ page }) => {
    await page.goto("/en");
    await expect(page.getByRole("heading", { name: /code anywhere/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /playground/i }).first()).toBeVisible();
  });

  test("navigation works between locales", async ({ page }) => {
    await page.goto("/en");
    await page.goto("/zh-CN");
    const html = await page.locator("html").getAttribute("lang");
    expect(html).toBe("zh-CN");
  });

  test("sign-in page renders", async ({ page }) => {
    await page.goto("/en/sign-in");
    await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();
  });

  test("playground renders editor", async ({ page }) => {
    await page.goto("/en/playground");
    await expect(page.getByRole("combobox").first()).toBeVisible({ timeout: 10000 });
  });
});

test.describe("offline", () => {
  test("offline page exists", async ({ page }) => {
    const res = await page.goto("/offline");
    expect(res).not.toBeNull();
  });
});
