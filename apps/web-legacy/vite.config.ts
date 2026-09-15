import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import netlify from "@netlify/vite-plugin-tanstack-start";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [
    tsconfigPaths(),
    tanstackStart(),
    netlify(),
    react({
      babel: {
        plugins: ["babel-plugin-react-compiler"],
      },
    }),
  ],
});
