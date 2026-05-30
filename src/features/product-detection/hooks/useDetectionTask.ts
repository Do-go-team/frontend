import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ENV_PRODUCT_DETECTION_ADAPTER } from "../product-detection.adapter";
import type { DetectionTask } from "../product-detection.types";

const detectionTaskQueryKey = (taskId: number | null) =>
	["product-detection-task", taskId] as const;

export function useCreateDetectionTask() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (params: {
			fixtureId: number;
			file: File;
			storeId?: number;
			fixtureVersionId?: number;
		}) => ENV_PRODUCT_DETECTION_ADAPTER.createTask(params),
		onSuccess: (task) => {
			queryClient.invalidateQueries({
				queryKey: detectionTaskQueryKey(task.detection_task_id),
			});
		},
	});
}

export function useGenerate3DForDetectionItems() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (params: {
			taskId: number;
			selectedItemIds: number[];
			rejectUnselected?: boolean;
		}) => ENV_PRODUCT_DETECTION_ADAPTER.generate3D(params),
		onSuccess: (result) => {
			queryClient.invalidateQueries({
				queryKey: detectionTaskQueryKey(result.detection_task_id),
			});
		},
	});
}

export function useRejectDetectionItem() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (params: { taskId: number; itemId: number }) =>
			ENV_PRODUCT_DETECTION_ADAPTER.rejectItem(params),
		onSuccess: (result) => {
			queryClient.invalidateQueries({
				queryKey: detectionTaskQueryKey(result.detection_task_id),
			});
		},
	});
}

export function useDetectionTaskQuery(taskId: number | null) {
	return useQuery({
		queryKey: detectionTaskQueryKey(taskId),
		queryFn: () =>
			ENV_PRODUCT_DETECTION_ADAPTER.getTask(taskId ?? 0, {
				includeRejected: false,
			}),
		enabled: taskId !== null,
		refetchInterval: (query) => {
			const status = (query.state.data as DetectionTask | undefined)?.status;
			if (!status) return 2000;
			return status === "COMPLETED" || status === "FAILED" ? false : 2000;
		},
	});
}
