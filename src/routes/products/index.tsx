import { createFileRoute } from "@tanstack/react-router";
import { ProductCatalogManager } from "@/features/product/components/ProductCatalogManager";

export const Route = createFileRoute("/products/")({
	component: ProductsPage,
});

function ProductsPage() {
	return (
		<main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 py-10">
			<ProductCatalogManager title="전체 상품 카탈로그" />
		</main>
	);
}
