export const LOGGED_IN_KEY = "logged_in";

export function isLoggedInPersisted() {
	if (typeof window === "undefined") return false;
	return window.localStorage.getItem(LOGGED_IN_KEY) === "1";
}
