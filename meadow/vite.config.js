import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
  build: {
    outDir: "../static/meadow",
    emptyOutDir: true,
    lib: {
      entry: "src/main.jsx",
      name: "Meadow",
      formats: ["es"],
      fileName: () => "meadow.js",
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
});
