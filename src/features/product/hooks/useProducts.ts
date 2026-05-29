import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { productRest } from "../product.rest";
import type {
	CreateProductRequest,
	UpdateProductRequest,
} from "../product.types";

export function useProductsQuery() {
	return useQuery({
		queryKey: ["products"],
		queryFn: () => productRest.getProducts(),
		staleTime: 15_000,
	});
}

export function useProductDetailQuery(productId: number | null) {
	return useQuery({
		queryKey: ["products", productId],
		queryFn: () => productRest.getProductDetail(productId ?? 0),
		enabled: productId !== null,
		staleTime: 15_000,
	});
}

export function useCreateProducts() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (req: CreateProductRequest) => productRest.createProduct(req),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["products"] });
		},
	});
}

export function useUpdateProduct() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({
			productId,
			req,
		}: {
			productId: number;
			req: UpdateProductRequest;
		}) => productRest.updateProduct(productId, req),
		onSuccess: (_data, variables) => {
			queryClient.invalidateQueries({ queryKey: ["products"] });
			queryClient.invalidateQueries({
				queryKey: ["products", variables.productId],
			});
		},
	});
}

export function useDeleteProduct() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (productId: number) => productRest.deleteProduct(productId),
		onSuccess: (_data, productId) => {
			queryClient.invalidateQueries({ queryKey: ["products"] });
			queryClient.removeQueries({ queryKey: ["products", productId] });
		},
	});
}
