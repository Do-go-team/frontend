import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fixtureRest } from "../fixture.rest";
import type {
	CreateFixtureRequest,
	CreateFixtureVersionRequest,
	UpdateFixtureRequest,
	UpdatePlacementsRequest,
} from "../fixture.types";

export function useFixturesQuery() {
	return useQuery({
		queryKey: ["fixtures"],
		queryFn: () => fixtureRest.getFixtures(),
		staleTime: 15_000,
	});
}

export function useFixtureDetailQuery(fixtureId: number | null) {
	return useQuery({
		queryKey: ["fixtures", fixtureId],
		queryFn: () => fixtureRest.getFixtureDetail(fixtureId ?? 0),
		enabled: fixtureId !== null,
		staleTime: 15_000,
	});
}

export function useCreateFixture() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (req: CreateFixtureRequest) => fixtureRest.createFixture(req),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["fixtures"] });
		},
	});
}

export function useUpdateFixture() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({
			fixtureId,
			req,
		}: {
			fixtureId: number;
			req: UpdateFixtureRequest;
		}) => fixtureRest.updateFixture(fixtureId, req),
		onSuccess: (_data, variables) => {
			queryClient.invalidateQueries({ queryKey: ["fixtures"] });
			queryClient.invalidateQueries({
				queryKey: ["fixtures", variables.fixtureId],
			});
		},
	});
}

export function useDeleteFixture() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (fixtureId: number) => fixtureRest.deleteFixture(fixtureId),
		onSuccess: (_data, fixtureId) => {
			queryClient.invalidateQueries({ queryKey: ["fixtures"] });
			queryClient.removeQueries({ queryKey: ["fixtures", fixtureId] });
			queryClient.removeQueries({ queryKey: ["fixture-versions", fixtureId] });
		},
	});
}

export function useFixtureVersionsQuery(fixtureId: number | null) {
	return useQuery({
		queryKey: ["fixture-versions", fixtureId],
		queryFn: () => fixtureRest.getFixtureVersions(fixtureId ?? 0),
		enabled: fixtureId !== null,
		staleTime: 15_000,
	});
}

export function useCreateFixtureVersion(fixtureId: number) {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (req: CreateFixtureVersionRequest) =>
			fixtureRest.createFixtureVersion(fixtureId, req),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["fixture-versions", fixtureId],
			});
		},
	});
}

export function useDeleteFixtureVersion(fixtureId: number) {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (versionId: number) =>
			fixtureRest.deleteFixtureVersion(fixtureId, versionId),
		onSuccess: (_data, versionId) => {
			queryClient.invalidateQueries({
				queryKey: ["fixture-versions", fixtureId],
			});
			queryClient.removeQueries({
				queryKey: ["fixture-placements", fixtureId, versionId],
			});
		},
	});
}

export function usePlacementsQuery(
	fixtureId: number | null,
	versionId: number | null,
) {
	return useQuery({
		queryKey: ["fixture-placements", fixtureId, versionId],
		queryFn: () => fixtureRest.getPlacements(fixtureId ?? 0, versionId ?? 0),
		enabled: fixtureId !== null && versionId !== null,
		staleTime: 15_000,
	});
}

export function useUpdatePlacements(
	fixtureId: number | null,
	versionId: number | null,
) {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (req: UpdatePlacementsRequest) =>
			fixtureRest.updatePlacements(fixtureId ?? 0, versionId ?? 0, req),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["fixture-placements", fixtureId, versionId],
			});
		},
	});
}
