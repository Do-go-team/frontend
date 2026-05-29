export const PUBLIC_PATHS = [
	"/landing",
	"/login",
	"/register",
	"/invite",
	"/demo",
] as const;

export function isPublicPath(pathname: string) {
	return PUBLIC_PATHS.includes(pathname as (typeof PUBLIC_PATHS)[number]);
}
