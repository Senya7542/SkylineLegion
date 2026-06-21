import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const repositoryName = process.env.GITHUB_REPOSITORY?.split("/")[1];
const isSingleFileBuild = process.env.SINGLE_FILE_BUILD === "1";
const base = isSingleFileBuild
  ? "./"
  : process.env.GITHUB_ACTIONS && repositoryName
    ? `/${repositoryName}/`
    : "/";

export default defineConfig({
  base,
  build: {
    rollupOptions: {
      output: {
        manualChunks: isSingleFileBuild
          ? undefined
          : (id) => {
              if (id.includes("node_modules")) return "vendor";
              return undefined;
            },
      },
    },
  },
  optimizeDeps: {
    include: ["react", "react-dom/client"],
  },
  server: {
    warmup: {
      clientFiles: ["./src/main.jsx"],
    },
  },
  plugins: [react()],
});
