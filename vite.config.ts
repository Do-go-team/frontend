import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), "");
	const apiProxyTarget =
		env.VITE_API_PROXY_TARGET || "https://do-goproject.com";

	return {
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
					target: apiProxyTarget,
					changeOrigin: true,
					secure: false,
					cookieDomainRewrite: "localhost",
					configure: (proxy) => {
						proxy.on("proxyReq", (proxyReq) => {
							proxyReq.setHeader("Origin", apiProxyTarget);
							proxyReq.setHeader("Referer", `${apiProxyTarget}/`);
						});
					},
				},
				"/media": {
					target: apiProxyTarget,
					changeOrigin: true,
					secure: false,
				},
			},
		},
	};
});
