import path from "path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { CodeInspectorPlugin } from "@rdservices/aime-code-inspector";

// BASE_PATH lets the same build target both Aime preview ("/") and GitHub
// Pages project sites ("/<repo>/").  Set BASE_PATH in CI, e.g.
//   BASE_PATH=/follow-builders-site/ pnpm build
export default defineConfig({
  base: process.env.BASE_PATH || "/",
  plugins: [
    react(),
    // IMPORTANT: DO NOT REMOVE THIS!
    CodeInspectorPlugin({
      bundler: "vite",
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
