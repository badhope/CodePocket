import { test, expect } from "@playwright/test";

test.describe("home page", () => {
  test("renders hero and languages grid", async ({ page }) => {
    await page.goto("/en");
    await expect(page.getByRole("heading", { name: /OnlineCode/i })).toBeVisible({ timeout: 10000 });
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
    // CardTitle is not a semantic heading, use text selector
    await expect(page.locator("text=Sign in").first()).toBeVisible({ timeout: 15000 });
  });

  test("playground renders with all features", async ({ page }) => {
    await page.goto("/en/playground");
    // Language selector
    await expect(page.getByRole("combobox").first()).toBeVisible({ timeout: 15000 });
    // Run button
    await expect(page.getByRole("button", { name: /run/i })).toBeVisible();
    // Templates tab
    await expect(page.getByText("Templates")).toBeVisible();
    // Packages tab
    await expect(page.getByText("Packages")).toBeVisible();
    // Stdin section
    await expect(page.getByPlaceholder(/stdin/i)).toBeVisible();
  });
});

test.describe("offline", () => {
  test("offline page exists", async ({ page }) => {
    const res = await page.goto("/offline");
    expect(res).not.toBeNull();
    expect(res!.status()).toBe(200);
  });
});
