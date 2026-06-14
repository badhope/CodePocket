import { test, expect } from "@playwright/test";

const NAV_TIMEOUT = 60000;
const ELEM_TIMEOUT = 30000;

test.describe("home page", () => {
  test("renders hero heading", async ({ page }) => {
    await page.goto("/en", { timeout: NAV_TIMEOUT });
    await expect(page.getByRole("heading", { name: "DocForge", exact: true })).toBeVisible({
      timeout: ELEM_TIMEOUT,
    });
  });

  test("navigation works between locales", async ({ page }) => {
    await page.goto("/en", { timeout: NAV_TIMEOUT });
    await page.goto("/zh-CN", { timeout: NAV_TIMEOUT });
    const html = await page.locator("html").getAttribute("lang");
    expect(html).toBe("zh-CN");
  });

  test("sign-in page renders", async ({ page }) => {
    await page.goto("/en/sign-in", { timeout: NAV_TIMEOUT });
    await expect(page.locator("text=Sign in").first()).toBeVisible({ timeout: ELEM_TIMEOUT });
  });
});

test.describe("pages", () => {
  test("pricing page loads", async ({ page }) => {
    const res = await page.goto("/en/pricing", { timeout: NAV_TIMEOUT });
    expect(res).not.toBeNull();
    expect(res!.status()).toBe(200);
  });

  test("dashboard returns 200", async ({ page }) => {
    const res = await page.goto("/en/dashboard", { timeout: NAV_TIMEOUT });
    expect(res).not.toBeNull();
    expect(res!.status()).toBe(200);
  });
});
