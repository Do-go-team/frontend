import { useParams } from "@tanstack/react-router";
import { ProductCatalogManager } from "@/features/product/components/ProductCatalogManager";

export function ProductsTab() {
	const { storeId } = useParams({
		from: "/stores/$storeId/layouts/$layoutId/edit",
	});

	return <ProductCatalogManager storeId={Number(storeId)} />;
}
