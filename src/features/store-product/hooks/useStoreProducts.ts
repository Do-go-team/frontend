import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { storeProductRest } from "../store-product.rest";
import type { UpdateStoreProductRequest } from "../store-product.types";

export function useStoreProductsQuery(storeId: number | null) {
	return useQuery({
		queryKey: ["store-products", storeId],
		queryFn: () => storeProductRest.getStoreProducts(storeId ?? 0),
		enabled: storeId !== null,
		staleTime: 15_000,
	});
}

export function useAssignStoreProducts(storeId: number) {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (productIds: number[]) =>
			storeProductRest.assignProducts(storeId, { product_ids: productIds }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["products"] });
			queryClient.invalidateQueries({ queryKey: ["store-products", storeId] });
		},
	});
}

export function useUpdateStoreProduct(storeId: number) {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({
			productId,
			req,
		}: {
			productId: number;
			req: UpdateStoreProductRequest;
		}) => storeProductRest.updateStoreProduct(storeId, productId, req),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["store-products", storeId] });
		},
	});
}

export function useRemoveStoreProduct(storeId: number) {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (productId: number) =>
			storeProductRest.removeStoreProduct(storeId, productId),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["products"] });
			queryClient.invalidateQueries({ queryKey: ["store-products", storeId] });
		},
	});
}
