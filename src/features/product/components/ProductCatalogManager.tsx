import { startTransition, useDeferredValue, useMemo, useState } from "react";
import {
	useDeleteProduct,
	useProductDetailQuery,
	useProductsQuery,
	useUpdateProduct,
} from "@/features/product/hooks/useProducts";
import type {
	ProductItem,
	ProductVariant,
	UpdateProductRequest,
	UpdateProductVariantInput,
} from "@/features/product/product.types";
import {
	useAssignStoreProducts,
	useRemoveStoreProduct,
	useStoreProductsQuery,
	useUpdateStoreProduct,
} from "@/features/store-product/hooks/useStoreProducts";
import type { StoreProductItem } from "@/features/store-product/store-product.types";
import { Button, Input, Skeleton } from "@/shared/components/ui";
import { cn } from "@/shared/lib/utils";
import { getErrorMessage } from "@/shared/utils/error";

interface ProductCatalogManagerProps {
	storeId?: number;
	className?: string;
	title?: string;
}

interface VariantDraft {
	variant_id?: number;
	size: string;
	color: string;
	sku_code: string;
	barcode_image_url: string;
}

interface ProductDraft {
	name: string;
	price: string;
	width: string;
	height: string;
	depth: string;
	variants: VariantDraft[];
}

const EMPTY_VARIANT: VariantDraft = {
	size: "",
	color: "",
	sku_code: "",
	barcode_image_url: "",
};
const EMPTY_PRODUCTS: ProductItem[] = [];
const EMPTY_STORE_PRODUCTS: StoreProductItem[] = [];

function draftFromProduct(product: ProductItem): ProductDraft {
	return {
		name: product.name ?? "",
		price: product.price?.toString() ?? "",
		width: product.width.toString(),
		height: product.height.toString(),
		depth: product.depth?.toString() ?? "",
		variants:
			product.variants.length > 0
				? product.variants.map((variant) => ({
						variant_id: variant.id,
						size: variant.size ?? "",
						color: variant.color ?? "",
						sku_code: variant.sku_code ?? "",
						barcode_image_url: variant.barcode_image_url ?? "",
					}))
				: [{ ...EMPTY_VARIANT }],
	};
}

function buildUpdateRequest(draft: ProductDraft): UpdateProductRequest {
	return {
		name: draft.name.trim() || undefined,
		price: parseOptionalNumber(draft.price),
		width: parseOptionalNumber(draft.width),
		height: parseOptionalNumber(draft.height),
		depth: parseOptionalNumber(draft.depth),
		variants: draft.variants.map(
			(variant): UpdateProductVariantInput => ({
				variant_id: variant.variant_id,
				size: variant.size.trim() || undefined,
				color: variant.color.trim() || undefined,
				sku_code: variant.sku_code.trim() || undefined,
				barcode_image_url: variant.barcode_image_url.trim() || undefined,
			}),
		),
	};
}

function parseOptionalNumber(value: string) {
	const trimmed = value.trim();
	if (!trimmed) return undefined;
	const parsed = Number(trimmed);
	return Number.isFinite(parsed) ? parsed : undefined;
}

function ProductVariantSummary({ variants }: { variants: ProductVariant[] }) {
	if (variants.length === 0) {
		return <p className="text-[11px] text-muted-foreground">옵션 없음</p>;
	}

	return (
		<div className="flex flex-wrap gap-1">
			{variants.slice(0, 3).map((variant) => (
				<span
					key={variant.id}
					className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-secondary-foreground"
				>
					{variant.sku_code ?? `옵션 #${variant.id}`}
				</span>
			))}
			{variants.length > 3 && (
				<span className="text-[10px] text-muted-foreground">
					+{variants.length - 3}
				</span>
			)}
		</div>
	);
}

export function ProductCatalogManager({
	storeId,
	className,
	title = "상품 카탈로그",
}: ProductCatalogManagerProps) {
	const [search, setSearch] = useState("");
	const deferredSearch = useDeferredValue(search);
	const [selectedProductId, setSelectedProductId] = useState<number | null>(
		null,
	);

	const productsQuery = useProductsQuery();
	const storeProductsQuery = useStoreProductsQuery(storeId ?? null);
	const deleteProduct = useDeleteProduct();
	const assignStoreProducts = useAssignStoreProducts(storeId ?? 0);
	const updateStoreProduct = useUpdateStoreProduct(storeId ?? 0);
	const removeStoreProduct = useRemoveStoreProduct(storeId ?? 0);

	const products = productsQuery.data?.products ?? EMPTY_PRODUCTS;
	const storeProducts =
		storeProductsQuery.data?.products ?? EMPTY_STORE_PRODUCTS;
	const storeProductMap = useMemo(
		() => new Map(storeProducts.map((product) => [product.id, product])),
		[storeProducts],
	);

	const filteredProducts = useMemo(() => {
		const keyword = deferredSearch.trim().toLowerCase();
		if (!keyword) return products;
		return products.filter((product) => {
			const name = product.name?.toLowerCase() ?? "";
			const sku = product.variants
				.map((variant) => variant.sku_code?.toLowerCase() ?? "")
				.join(" ");
			return name.includes(keyword) || sku.includes(keyword);
		});
	}, [deferredSearch, products]);

	function handleSelect(productId: number) {
		startTransition(() => {
			setSelectedProductId(productId);
		});
	}

	function handleDelete(productId: number) {
		if (!window.confirm("이 상품을 삭제하시겠습니까?")) return;
		deleteProduct.mutate(productId, {
			onSuccess: () => {
				if (selectedProductId === productId) {
					setSelectedProductId(null);
				}
			},
		});
	}

	function handleAssign(productId: number) {
		if (!storeId) return;
		assignStoreProducts.mutate([productId]);
	}

	function handleToggleStatus(
		productId: number,
		nextStatus: "ACTIVE" | "PAUSED",
	) {
		if (!storeId) return;
		updateStoreProduct.mutate({
			productId,
			req: { status: nextStatus },
		});
	}

	function handleRemoveStoreProduct(productId: number) {
		if (!storeId) return;
		removeStoreProduct.mutate(productId);
	}

	return (
		<section className={cn("flex flex-col gap-4", className)}>
			<div className="rounded-lg bg-white p-4">
				<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<h2 className="text-sm font-semibold text-text">{title}</h2>
						<p className="text-xs text-muted-foreground">
							신규 상품 생성은 Fixtures 탭의 상품 탐지 결과에서 시작합니다.
						</p>
					</div>
					<Input
						value={search}
						onChange={(event) => setSearch(event.target.value)}
						placeholder="상품명 또는 SKU 검색"
						className="sm:max-w-xs"
					/>
				</div>

				{storeId && (
					<div className="mt-3 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
						<span>매장 취급 상품 {storeProducts.length}개</span>
						<span>전체 카탈로그 {products.length}개</span>
					</div>
				)}
			</div>

			<div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,380px)]">
				<div className="rounded-lg bg-white p-4">
					<h3 className="mb-3 text-sm font-semibold text-text">상품 목록</h3>

					{productsQuery.isLoading ? (
						<div className="space-y-2">
							<Skeleton className="h-20 rounded-lg" />
							<Skeleton className="h-20 rounded-lg" />
						</div>
					) : filteredProducts.length === 0 ? (
						<p className="text-sm text-muted-foreground">
							조건에 맞는 상품이 없습니다.
						</p>
					) : (
						<div className="space-y-3">
							{filteredProducts.map((product) => {
								const assigned = storeProductMap.get(product.id);
								return (
									<div
										key={product.id}
										className={cn(
											"rounded-lg border p-3 transition-colors",
											selectedProductId === product.id
												? "border-primary bg-primary/5"
												: "border-border",
										)}
									>
										<button
											type="button"
											onClick={() => handleSelect(product.id)}
											className="flex w-full flex-col gap-2 text-left"
										>
											<div className="flex items-start justify-between gap-3">
												<div>
													<p className="text-sm font-semibold text-text">
														{product.name ?? `임시 상품 #${product.id}`}
													</p>
													<p className="text-[11px] text-muted-foreground">
														{product.width} × {product.height} ×{" "}
														{product.depth ?? "-"} cm
													</p>
												</div>
												{assigned && (
													<span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-secondary-foreground">
														{assigned.status}
													</span>
												)}
											</div>
											<ProductVariantSummary variants={product.variants} />
										</button>

										{storeId && (
											<div className="mt-3 flex flex-wrap gap-2">
												{assigned ? (
													<>
														<Button
															size="sm"
															variant="secondary"
															onClick={() =>
																handleToggleStatus(
																	product.id,
																	assigned.status === "ACTIVE"
																		? "PAUSED"
																		: "ACTIVE",
																)
															}
														>
															{assigned.status === "ACTIVE"
																? "판매 중지"
																: "판매 재개"}
														</Button>
														<Button
															size="sm"
															variant="outline"
															onClick={() =>
																handleRemoveStoreProduct(product.id)
															}
														>
															매장 제외
														</Button>
													</>
												) : (
													<Button
														size="sm"
														data-track="add-store-product"
														data-track-value={
															product.name ?? `임시 상품 #${product.id}`
														}
														onClick={() => handleAssign(product.id)}
													>
														매장에 추가
													</Button>
												)}
											</div>
										)}
									</div>
								);
							})}
						</div>
					)}
				</div>

				<ProductDetailEditor
					productId={selectedProductId}
					onDelete={handleDelete}
				/>
			</div>
		</section>
	);
}

function ProductDetailEditor({
	productId,
	onDelete,
}: {
	productId: number | null;
	onDelete: (productId: number) => void;
}) {
	const detailQuery = useProductDetailQuery(productId);

	return (
		<div className="rounded-lg bg-white p-4">
			<h3 className="mb-3 text-sm font-semibold text-text">상품 상세 수정</h3>
			{productId === null ? (
				<p className="text-sm text-muted-foreground">
					왼쪽 목록에서 상품을 선택하세요.
				</p>
			) : detailQuery.isLoading || !detailQuery.data ? (
				<div className="space-y-2">
					<Skeleton className="h-10 rounded-md" />
					<Skeleton className="h-10 rounded-md" />
					<Skeleton className="h-32 rounded-md" />
				</div>
			) : (
				<ProductDetailForm
					key={detailQuery.data.product_id}
					product={detailQuery.data}
					onDelete={onDelete}
				/>
			)}
		</div>
	);
}

function ProductDetailForm({
	product,
	onDelete,
}: {
	product: ProductItem & { product_id: number };
	onDelete: (productId: number) => void;
}) {
	const [draft, setDraft] = useState<ProductDraft>(() =>
		draftFromProduct(product),
	);
	const [saveMessage, setSaveMessage] = useState<string | null>(null);
	const updateProduct = useUpdateProduct();

	function updateDraft<K extends keyof ProductDraft>(
		key: K,
		value: ProductDraft[K],
	) {
		setDraft((current) => ({ ...current, [key]: value }));
	}

	function updateVariant(
		index: number,
		key: keyof VariantDraft,
		value: string,
	) {
		setDraft((current) => ({
			...current,
			variants: current.variants.map((variant, variantIndex) =>
				variantIndex === index ? { ...variant, [key]: value } : variant,
			),
		}));
	}

	function addVariantRow() {
		setDraft((current) => ({
			...current,
			variants: [...current.variants, { ...EMPTY_VARIANT }],
		}));
	}

	function removeVariantRow(index: number) {
		setDraft((current) => {
			const variants = current.variants.filter(
				(_, variantIndex) => variantIndex !== index,
			);
			return {
				...current,
				variants: variants.length > 0 ? variants : [{ ...EMPTY_VARIANT }],
			};
		});
	}

	function handleSave() {
		setSaveMessage(null);
		updateProduct.mutate(
			{
				productId: product.product_id,
				req: buildUpdateRequest(draft),
			},
			{
				onSuccess: () => setSaveMessage("상품 정보를 저장했습니다."),
				onError: (error) => setSaveMessage(getErrorMessage(error as Error)),
			},
		);
	}

	return (
		<div className="space-y-4">
			<div className="grid gap-3">
				<label
					htmlFor="product-name"
					className="flex flex-col gap-1 text-xs font-medium text-text"
				>
					상품명
					<Input
						id="product-name"
						value={draft.name}
						onChange={(event) => updateDraft("name", event.target.value)}
					/>
				</label>
				<div className="grid grid-cols-2 gap-3">
					<label
						htmlFor="product-price"
						className="flex flex-col gap-1 text-xs font-medium text-text"
					>
						가격
						<Input
							id="product-price"
							type="number"
							value={draft.price}
							onChange={(event) => updateDraft("price", event.target.value)}
						/>
					</label>
					<label
						htmlFor="product-depth"
						className="flex flex-col gap-1 text-xs font-medium text-text"
					>
						깊이
						<Input
							id="product-depth"
							type="number"
							value={draft.depth}
							onChange={(event) => updateDraft("depth", event.target.value)}
						/>
					</label>
				</div>
				<div className="grid grid-cols-2 gap-3">
					<label
						htmlFor="product-width"
						className="flex flex-col gap-1 text-xs font-medium text-text"
					>
						가로
						<Input
							id="product-width"
							type="number"
							value={draft.width}
							onChange={(event) => updateDraft("width", event.target.value)}
						/>
					</label>
					<label
						htmlFor="product-height"
						className="flex flex-col gap-1 text-xs font-medium text-text"
					>
						높이
						<Input
							id="product-height"
							type="number"
							value={draft.height}
							onChange={(event) => updateDraft("height", event.target.value)}
						/>
					</label>
				</div>
			</div>

			<div className="rounded-lg border border-border p-3">
				<div className="mb-3 flex items-center justify-between">
					<h4 className="text-xs font-semibold text-text">옵션</h4>
					<Button size="sm" variant="outline" onClick={addVariantRow}>
						옵션 추가
					</Button>
				</div>
				<div className="space-y-3">
					{draft.variants.map((variant, index) => (
						<div
							key={variant.variant_id ?? `new-${index}`}
							className="rounded-md border border-border p-3"
						>
							<div className="grid gap-2">
								<Input
									value={variant.sku_code}
									onChange={(event) =>
										updateVariant(index, "sku_code", event.target.value)
									}
									placeholder="SKU 코드"
								/>
								<div className="grid grid-cols-2 gap-2">
									<Input
										value={variant.size}
										onChange={(event) =>
											updateVariant(index, "size", event.target.value)
										}
										placeholder="사이즈"
									/>
									<Input
										value={variant.color}
										onChange={(event) =>
											updateVariant(index, "color", event.target.value)
										}
										placeholder="색상"
									/>
								</div>
								<Input
									value={variant.barcode_image_url}
									onChange={(event) =>
										updateVariant(
											index,
											"barcode_image_url",
											event.target.value,
										)
									}
									placeholder="바코드 이미지 URL"
								/>
							</div>
							<div className="mt-2 flex justify-end">
								<Button
									size="sm"
									variant="ghost"
									onClick={() => removeVariantRow(index)}
								>
									행 제거
								</Button>
							</div>
						</div>
					))}
				</div>
			</div>

			{saveMessage && (
				<p className="text-xs text-muted-foreground">{saveMessage}</p>
			)}
			<div className="flex flex-wrap gap-2">
				<Button onClick={handleSave} disabled={updateProduct.isPending}>
					{updateProduct.isPending ? "저장 중..." : "저장"}
				</Button>
				<Button
					variant="destructive"
					onClick={() => onDelete(product.product_id)}
				>
					삭제
				</Button>
			</div>
		</div>
	);
}
