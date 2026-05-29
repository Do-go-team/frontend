import { mockLayoutAdapter } from "./layout.mock";
import { restLayoutAdapter } from "./layout.rest";
import type {
	CopyFixturesRequest,
	CopyFixturesResponse,
	CreateLayoutRequest,
	CreateLayoutResponse,
	DeleteLayoutResponse,
	ExportLayoutPdfRequest,
	ExportLayoutPdfResponse,
	GetLayoutsResponse,
	LayoutDetail,
	UpdateLayoutRequest,
	UpdateLayoutResponse,
} from "./layout.types";

export interface LayoutAdapter {
	getLayouts: (storeId: number) => Promise<GetLayoutsResponse>;
	createLayout: (
		storeId: number,
		req: CreateLayoutRequest,
	) => Promise<CreateLayoutResponse>;
	deleteLayout: (layoutId: number) => Promise<DeleteLayoutResponse>;
	getLayoutDetail: (layoutId: number) => Promise<LayoutDetail>;
	updateLayout: (
		layoutId: number,
		req: UpdateLayoutRequest,
	) => Promise<UpdateLayoutResponse>;
	copyFixtures: (
		layoutId: number,
		req: CopyFixturesRequest,
	) => Promise<CopyFixturesResponse>;
	exportPdf: (
		storeId: number,
		layoutId: number,
		req?: ExportLayoutPdfRequest,
	) => Promise<ExportLayoutPdfResponse>;
}

export const ENV_LAYOUT_ADAPTER: LayoutAdapter =
	import.meta.env.VITE_USE_MOCK === "true"
		? mockLayoutAdapter
		: restLayoutAdapter;
