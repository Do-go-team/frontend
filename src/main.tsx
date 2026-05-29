import * as Sentry from "@sentry/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

if (import.meta.env.VITE_SENTRY_DSN) {
	Sentry.init({
		dsn: import.meta.env.VITE_SENTRY_DSN,
		integrations: [
			Sentry.browserTracingIntegration(),
			Sentry.replayIntegration(),
		],
		tracesSampleRate: 1.0,
		replaysSessionSampleRate: 0.1,
		replaysOnErrorSampleRate: 1.0,
	});
}

// biome-ignore lint/style/noNonNullAssertion: root element is guaranteed by index.html
const root = createRoot(document.getElementById("root")!);

// i18next (~80 kB) is loaded asynchronously so it stays out of the main bundle.
// The app renders only after i18n is ready to avoid untranslated flicker.
import("./i18n").then(() => {
	root.render(
		<StrictMode>
			<App />
		</StrictMode>,
	);
});
