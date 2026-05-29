import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useState,
} from "react";
import { isLoggedInPersisted, LOGGED_IN_KEY } from "./auth-storage";

interface AuthContextValue {
	isLoggedIn: boolean;
	setLoggedIn: (value: boolean) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
	const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() =>
		isLoggedInPersisted(),
	);

	const setLoggedIn = useCallback((value: boolean) => {
		if (value) {
			localStorage.setItem(LOGGED_IN_KEY, "1");
		} else {
			localStorage.removeItem(LOGGED_IN_KEY);
		}
		setIsLoggedIn(value);
	}, []);

	useEffect(() => {
		const handler = () => {
			localStorage.removeItem(LOGGED_IN_KEY);
			setIsLoggedIn(false);
			if (window.location.pathname !== "/landing") {
				window.location.replace("/landing");
			}
		};
		window.addEventListener("auth:unauthorized", handler);
		return () => window.removeEventListener("auth:unauthorized", handler);
	}, []);

	return (
		<AuthContext value={{ isLoggedIn, setLoggedIn }}>{children}</AuthContext>
	);
}

export function useAuth() {
	const ctx = useContext(AuthContext);
	if (!ctx) throw new Error("useAuth must be used within AuthProvider");
	return ctx;
}
