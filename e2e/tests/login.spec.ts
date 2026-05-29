import { expect, test } from "@playwright/test";

test.describe("로그인 플로우", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/login");
	});

	test("페이지 진입 시 로그인 폼이 보인다", async ({ page }) => {
		await expect(page.getByLabel("이메일")).toBeVisible();
		await expect(page.getByLabel("비밀번호", { exact: true })).toBeVisible();
		await expect(page.getByRole("button", { name: "로그인" })).toBeVisible();
	});

	test("이메일 미입력 시 유효성 에러가 표시된다", async ({ page }) => {
		await page.getByRole("button", { name: "로그인" }).click();
		await expect(page.getByText("이메일을 입력해주세요.")).toBeVisible();
	});

	test("잘못된 이메일 형식 입력 시 에러가 표시된다", async ({ page }) => {
		await page.getByLabel("이메일").fill("notanemail");
		await page.getByRole("button", { name: "로그인" }).click();
		await expect(
			page.getByText("올바른 이메일 형식이 아닙니다."),
		).toBeVisible();
	});

	test("비밀번호 미입력 시 유효성 에러가 표시된다", async ({ page }) => {
		await page.getByLabel("이메일").fill("test@example.com");
		await page.getByRole("button", { name: "로그인" }).click();
		await expect(page.getByText("비밀번호를 입력해주세요.")).toBeVisible();
	});

	test("비밀번호 보기/숨기기 토글이 동작한다", async ({ page }) => {
		const passwordInput = page.locator("#password");
		const toggleBtn = page.locator('[aria-label="비밀번호 보기"]');
		await expect(passwordInput).toHaveAttribute("type", "password");
		await toggleBtn.click();
		await expect(passwordInput).toHaveAttribute("type", "text");
		await page.locator('[aria-label="비밀번호 숨기기"]').click();
		await expect(passwordInput).toHaveAttribute("type", "password");
	});

	test("로그인 성공 시 /stores로 이동한다", async ({ page }) => {
		await page.getByLabel("이메일").fill("test@example.com");
		await page.getByLabel("비밀번호", { exact: true }).fill("password1!");
		await page.getByRole("button", { name: "로그인" }).click();
		await expect(page).toHaveURL("/");
	});

	test("회원가입 링크가 /register로 이동한다", async ({ page }) => {
		await page.getByRole("link", { name: "회원가입" }).click();
		await expect(page).toHaveURL("/register");
	});
});
