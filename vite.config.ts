import path from "path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { CodeInspectorPlugin } from "@rdservices/aime-code-inspector";

// GitHub Pages project site: deployed at /ai-builders-site/
export default defineConfig({
  base: "/ai-builders-site/",
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
