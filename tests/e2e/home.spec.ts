import { test, expect } from "@playwright/test";

// Use longer timeouts for Next.js SSR + hydration
const NAV_TIMEOUT = 60000;
const ELEM_TIMEOUT = 30000;

test.describe("home page", () => {
  test("renders hero and languages grid", async ({ page }) => {
    await page.goto("/en", { timeout: NAV_TIMEOUT });
    await expect(page.getByRole("heading", { name: /OnlineCode/i })).toBeVisible({
      timeout: ELEM_TIMEOUT,
    });
    await expect(page.getByRole("link", { name: /playground/i }).first()).toBeVisible({
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

  test("playground renders editor and toolbar", async ({ page }) => {
    await page.goto("/en/playground", { timeout: NAV_TIMEOUT });
    // Language selector combobox
    await expect(page.getByRole("combobox").first()).toBeVisible({ timeout: ELEM_TIMEOUT });
    // Run button
    await expect(page.getByRole("button", { name: /run/i })).toBeVisible({ timeout: ELEM_TIMEOUT });
    // Templates and Packages tabs
    await expect(page.getByText("Templates")).toBeVisible({ timeout: ELEM_TIMEOUT });
    await expect(page.getByText("Packages")).toBeVisible({ timeout: ELEM_TIMEOUT });
    // Output section
    await expect(page.getByText("Output")).toBeVisible({ timeout: ELEM_TIMEOUT });
  });

  test("playground has stdin input", async ({ page }) => {
    await page.goto("/en/playground", { timeout: NAV_TIMEOUT });
    await expect(page.getByPlaceholder(/stdin/i)).toBeVisible({ timeout: ELEM_TIMEOUT });
  });
});

test.describe("pages", () => {
  test("docs page loads", async ({ page }) => {
    const res = await page.goto("/en/docs", { timeout: NAV_TIMEOUT });
    expect(res).not.toBeNull();
    expect(res!.status()).toBe(200);
  });

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

test.describe("offline", () => {
  test("offline page exists", async ({ page }) => {
    const res = await page.goto("/offline", { timeout: NAV_TIMEOUT });
    expect(res).not.toBeNull();
    expect(res!.status()).toBe(200);
  });
});
