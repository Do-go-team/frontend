import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const API_PROXY_TARGET = "https://k14f106.p.ssafy.io";

// https://vite.dev/config/
export default defineConfig({
	plugins: [
		tailwindcss(),
		tanstackRouter({
			target: "react",
			autoCodeSplitting: true,
		}),
		react(),
	],
	resolve: {
		alias: { "@": path.resolve(__dirname, "./src") },
	},
	server: {
		watch: {
			ignored: [
				"**/node_modules/**",
				"**/.git/**",
				"**/dist/**",
				"**/.tanstack/**",
			],
		},
		proxy: {
			"/api": {
				target: API_PROXY_TARGET,
				changeOrigin: true,
				secure: false,
				cookieDomainRewrite: "localhost",
				configure: (proxy) => {
					proxy.on("proxyReq", (proxyReq) => {
						proxyReq.setHeader("Origin", API_PROXY_TARGET);
						proxyReq.setHeader("Referer", `${API_PROXY_TARGET}/`);
					});
				},
			},
			"/media": {
				target: API_PROXY_TARGET,
				changeOrigin: true,
				secure: false,
			},
		},
	},
});
