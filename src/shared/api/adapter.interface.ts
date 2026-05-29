/**
 * 각 feature의 어댑터가 구현해야 할 기본 계약입니다.
 *
 * 사용 예시:
 *
 * ```ts
 * // features/store/store.adapter.ts
 * export interface StoreAdapter {
 *   fetchStores: () => Promise<Store[]>;
 *   fetchStore: (id: string) => Promise<Store>;
 * }
 *
 * // features/store/rest-store.adapter.ts
 * export const restStoreAdapter: StoreAdapter = {
 *   fetchStores: () => http.get("/stores", { auth: true }),
 *   fetchStore: (id) => http.get(`/stores/${id}`, { auth: true }),
 * };
 *
 * // features/store/mock-store.adapter.ts
 * export const mockStoreAdapter: StoreAdapter = {
 *   fetchStores: async () => MOCK_STORES,
 *   fetchStore: async (id) => MOCK_STORES.find((s) => s.id === id)!,
 * };
 * ```
 *
 * React Query 훅에서 어댑터를 주입받아 사용합니다:
 *
 * ```ts
 * const ENV_ADAPTER: StoreAdapter =
 *   import.meta.env.DEV ? mockStoreAdapter : restStoreAdapter;
 *
 * export const useStores = (adapter: StoreAdapter = ENV_ADAPTER) =>
 *   useQuery({ queryKey: ["stores"], queryFn: adapter.fetchStores });
 * ```
 */
export type Adapter = Record<string, (...args: never[]) => Promise<unknown>>;
