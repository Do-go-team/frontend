import { expect, test } from "@playwright/test";
import { visitAsLoggedIn } from "./_helpers/auth";

test.describe("매장 목록 페이지", () => {
	test.beforeEach(async ({ page }) => {
		await visitAsLoggedIn(page, "/");
	});

	test("매장 카드 목록이 보인다", async ({ page }) => {
		await expect(page.getByText("DO-GO 홍대 본점")).toBeVisible();
		await expect(page.getByText("DO-GO 강남 팝업스토어")).toBeVisible();
	});

	test("매장 카드에 역할 배지와 크기 정보가 표시된다", async ({ page }) => {
		await expect(page.getByText("오너")).toBeVisible();
		await expect(page.getByText("VMD")).toBeVisible();
		await expect(
			page.getByText("가로 5,000 × 세로 4,500 × 높이 3,000 cm"),
		).toBeVisible();
	});

	test("매장 등록 버튼 클릭 시 /stores/new로 이동한다", async ({ page }) => {
		await page.getByRole("link", { name: "매장 등록" }).click();
		await expect(page).toHaveURL("/stores/new");
	});

	test("매장 카드 클릭 시 해당 매장의 레이아웃 페이지로 이동한다", async ({
		page,
	}) => {
		await page.getByText("DO-GO 홍대 본점").click();
		await expect(page).toHaveURL(/\/stores\/1\/layouts/);
	});
});

test.describe("매장 등록 페이지", () => {
	test.beforeEach(async ({ page }) => {
		await visitAsLoggedIn(page, "/stores/new");
	});

	test("매장 등록 폼이 보인다", async ({ page }) => {
		await expect(
			page.getByRole("heading", { name: "매장 등록" }),
		).toBeVisible();
		await expect(page.getByLabel("매장 이름")).toBeVisible();
		await expect(page.getByLabel("매장 주소")).toBeVisible();
		await expect(page.getByLabel("가로")).toBeVisible();
		await expect(page.getByLabel("세로")).toBeVisible();
		await expect(page.getByLabel("높이")).toBeVisible();
	});

	test("가로/세로/높이 기본값이 입력되어 있다", async ({ page }) => {
		await expect(page.getByLabel("가로")).toHaveValue("2000");
		await expect(page.getByLabel("세로")).toHaveValue("1000");
		await expect(page.getByLabel("높이")).toHaveValue("1000");
	});

	test("매장 이름 미입력 시 에러 메시지가 표시된다", async ({ page }) => {
		await page.getByRole("button", { name: "매장 등록" }).click();
		await expect(page.getByText("매장 이름을 입력해주세요.")).toBeVisible();
	});

	test("매장 주소 미입력 시 에러 메시지가 표시된다", async ({ page }) => {
		await page.getByLabel("매장 이름").fill("테스트 매장");
		await page.getByRole("button", { name: "매장 등록" }).click();
		await expect(page.getByText("매장 주소를 입력해주세요.")).toBeVisible();
	});

	test("정상 입력 후 제출 시 /로 이동한다", async ({ page }) => {
		await page.getByLabel("매장 이름").fill("테스트 매장");
		await page.getByLabel("매장 주소").fill("서울시 마포구 홍대로 123");
		await page.getByRole("button", { name: "매장 등록" }).click();

		await expect(page).toHaveURL("/", { timeout: 5000 });
	});
});
