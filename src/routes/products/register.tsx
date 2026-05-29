import { createFileRoute } from "@tanstack/react-router";
import { ProductCatalogManager } from "@/features/product/components/ProductCatalogManager";

export const Route = createFileRoute("/products/register")({
	component: ProductRegisterPage,
});

function ProductRegisterPage() {
	return (
		<main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 py-10">
			<div className="mb-6 rounded-2xl bg-white p-6 shadow-sm">
				<h1 className="text-2xl font-bold text-text">상품 등록</h1>
				<p className="mt-2 text-sm text-muted-foreground">
					신규 상품 생성은 레이아웃 편집기의 Fixtures 탭에서 상품 탐지 결과를
					통해 시작합니다. 여기서는 생성된 placeholder 상품의 상세 정보를
					보완합니다.
				</p>
			</div>
			<ProductCatalogManager title="등록된 상품 보완" />
		</main>
	);
}
