import { expect, test } from "@playwright/test";

test.describe("회원가입 플로우", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/register");
	});

	test("페이지 진입 시 Step 1(이메일 입력)이 보인다", async ({ page }) => {
		await expect(page.getByRole("heading", { name: "회원가입" })).toBeVisible();
		await expect(page.getByLabel("이메일")).toBeVisible();
		await expect(
			page.getByRole("button", { name: "인증번호 발송" }),
		).toBeVisible();
	});

	test("Step 1: 이메일 입력 후 인증번호 발송 버튼 클릭 시 Step 2로 이동한다", async ({
		page,
	}) => {
		await page.getByLabel("이메일").fill("test@example.com");
		await page.getByRole("button", { name: "인증번호 발송" }).click();

		await expect(page.getByLabel("인증번호")).toBeVisible();
		await expect(
			page.getByText("test@example.com으로 인증번호를 발송했습니다."),
		).toBeVisible();
	});

	test("Step 2: 인증번호 입력 후 확인 클릭 시 Step 3으로 이동한다", async ({
		page,
	}) => {
		// Step 1 통과
		await page.getByLabel("이메일").fill("test@example.com");
		await page.getByRole("button", { name: "인증번호 발송" }).click();

		// Step 2
		await page.getByLabel("인증번호").fill("123456");
		await page.getByRole("button", { name: "확인" }).click();

		await expect(page.getByLabel("이름")).toBeVisible();
		await expect(page.getByLabel("비밀번호", { exact: true })).toBeVisible();
	});

	test("Step 2: 이메일 재입력 클릭 시 Step 1로 돌아간다", async ({ page }) => {
		// Step 1 통과
		await page.getByLabel("이메일").fill("test@example.com");
		await page.getByRole("button", { name: "인증번호 발송" }).click();

		// Step 2 → 뒤로
		await page.getByRole("button", { name: "이메일 재입력" }).click();

		await expect(page.getByLabel("이메일")).toBeVisible();
		await expect(
			page.getByRole("button", { name: "인증번호 발송" }),
		).toBeVisible();
	});

	test("Step 3: 회원가입 완료 후 /stores/new로 이동한다", async ({ page }) => {
		// Step 1 통과
		await page.getByLabel("이메일").fill("test@example.com");
		await page.getByRole("button", { name: "인증번호 발송" }).click();

		// Step 2 통과
		await page.getByLabel("인증번호").fill("123456");
		await page.getByRole("button", { name: "확인" }).click();

		// Step 3: 회원가입 정보 입력
		await page.getByLabel("이름").fill("테스트유저");
		await page.getByLabel("비밀번호", { exact: true }).fill("Test1234!");
		await page.getByLabel("비밀번호 확인").fill("Test1234!");
		await page.getByRole("button", { name: "가입하기" }).click();

		// mock 딜레이 후 매장 등록 페이지로 이동
		await expect(page).toHaveURL("/stores/new", { timeout: 5000 });
	});

	test("Step 3: 비밀번호 유효성 - 8자 미만이면 에러 메시지가 표시된다", async ({
		page,
	}) => {
		// Step 1, 2 통과
		await page.getByLabel("이메일").fill("test@example.com");
		await page.getByRole("button", { name: "인증번호 발송" }).click();
		await page.getByLabel("인증번호").fill("123456");
		await page.getByRole("button", { name: "확인" }).click();

		// 짧은 비밀번호 입력
		await page.getByLabel("비밀번호", { exact: true }).fill("Ab1!");
		await page.getByLabel("비밀번호", { exact: true }).blur();

		await expect(
			page.getByText("비밀번호는 8자 이상이어야 합니다."),
		).toBeVisible();
	});

	test("Step 3: 비밀번호 불일치 시 에러 메시지가 표시된다", async ({
		page,
	}) => {
		// Step 1, 2 통과
		await page.getByLabel("이메일").fill("test@example.com");
		await page.getByRole("button", { name: "인증번호 발송" }).click();
		await page.getByLabel("인증번호").fill("123456");
		await page.getByRole("button", { name: "확인" }).click();

		// 비밀번호 불일치
		await page.getByLabel("비밀번호", { exact: true }).fill("Test1234!");
		await page.getByLabel("비밀번호 확인").fill("Mismatch1!");
		await page.getByRole("button", { name: "가입하기" }).click();

		await expect(page.getByText("비밀번호가 일치하지 않습니다.")).toBeVisible();
	});
});
