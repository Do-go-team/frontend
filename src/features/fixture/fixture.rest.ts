import { http } from "@/shared/api/http";
import type {
	CreateFixtureRequest,
	CreateFixtureResponse,
	CreateFixtureVersionRequest,
	CreateFixtureVersionResponse,
	FixtureDetail,
	GetFixturesResponse,
	GetFixtureVersionsResponse,
	GetPlacementsResponse,
	UpdateFixtureRequest,
	UpdateFixtureResponse,
	UpdatePlacementsRequest,
	UpdatePlacementsResponse,
} from "./fixture.types";

export const fixtureRest = {
	getFixtures: (): Promise<GetFixturesResponse> => http.get("/fixtures"),

	getFixtureDetail: (fixtureId: number): Promise<FixtureDetail> =>
		http.get(`/fixtures/${fixtureId}`),

	createFixture: (req: CreateFixtureRequest): Promise<CreateFixtureResponse> =>
		http.post("/fixtures", req),

	updateFixture: (
		fixtureId: number,
		req: UpdateFixtureRequest,
	): Promise<UpdateFixtureResponse> =>
		http.patch(`/fixtures/${fixtureId}`, req),

	deleteFixture: (fixtureId: number): Promise<null> =>
		http.delete(`/fixtures/${fixtureId}`),

	// Versions
	getFixtureVersions: (
		fixtureId: number,
	): Promise<GetFixtureVersionsResponse> =>
		http.get(`/fixtures/${fixtureId}/versions`),

	createFixtureVersion: (
		fixtureId: number,
		req: CreateFixtureVersionRequest,
	): Promise<CreateFixtureVersionResponse> =>
		http.post(`/fixtures/${fixtureId}/versions`, req),

	deleteFixtureVersion: (fixtureId: number, versionId: number): Promise<null> =>
		http.delete(`/fixtures/${fixtureId}/versions/${versionId}`),

	// Placements
	getPlacements: (
		fixtureId: number,
		versionId: number,
	): Promise<GetPlacementsResponse> =>
		http.get(`/fixtures/${fixtureId}/versions/${versionId}/placements`),

	updatePlacements: (
		fixtureId: number,
		versionId: number,
		req: UpdatePlacementsRequest,
	): Promise<UpdatePlacementsResponse> =>
		http.patch(`/fixtures/${fixtureId}/versions/${versionId}/placements`, req),
};
