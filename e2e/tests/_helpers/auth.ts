import type { Page } from "@playwright/test";

export async function visitAsLoggedIn(page: Page, path: string) {
	await page.goto("/login");
	await page.evaluate(() => {
		window.localStorage.setItem("logged_in", "1");
		window.sessionStorage.setItem("token", "mock-access-token");
	});
	await page.goto(path);
}
