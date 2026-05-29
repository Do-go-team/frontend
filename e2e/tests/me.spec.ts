import { expect, test } from "@playwright/test";
import { visitAsLoggedIn } from "./_helpers/auth";

test.describe("마이페이지 플로우", () => {
	test.beforeEach(async ({ page }) => {
		await visitAsLoggedIn(page, "/me");
	});

	test("페이지 진입 시 프로필 정보가 표시된다", async ({ page }) => {
		const main = page.getByRole("main");
		await expect(main.getByText("사용자")).toBeVisible();
		await expect(main.getByText("user@example.com")).toBeVisible();
		await expect(main.getByText("USER", { exact: true })).toBeVisible();
	});

	test("프로필 이미지가 없을 때 이름 이니셜 아바타가 표시된다", async ({
		page,
	}) => {
		// mock: profile_image_url = null → 이니셜 "사" 렌더링
		const avatar = page
			.getByRole("main")
			.locator("div.rounded-full.bg-primary");
		await expect(avatar).toBeVisible();
		await expect(avatar).toContainText("사");
	});

	test("접근 매장 목록이 표시된다", async ({ page }) => {
		await expect(page.getByText("DO-GO 홍대 본점")).toBeVisible();
		await expect(page.getByText("DO-GO 강남 팝업스토어")).toBeVisible();
	});

	test("매장별 역할 배지가 표시된다", async ({ page }) => {
		await expect(page.getByText("오너")).toBeVisible();
		await expect(page.getByText("VMD")).toBeVisible();
	});

	test("매장 카드 클릭 시 해당 매장 레이아웃 페이지로 이동한다", async ({
		page,
	}) => {
		await page.getByText("DO-GO 홍대 본점").click();
		await expect(page).toHaveURL("/stores/1/layouts");
	});

	test("헤더의 이름 클릭 시 /me로 이동한다", async ({ page }) => {
		await visitAsLoggedIn(page, "/");
		await page.getByRole("link", { name: "사용자" }).click();
		await expect(page).toHaveURL("/me");
	});
});
