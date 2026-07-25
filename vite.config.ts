import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { readFileSync } from "fs";

const host = process.env.TAURI_DEV_HOST;

// Generate build date in YYYY.MM.DD format
const buildDate = new Date().toISOString().slice(0, 10).replace(/-/g, '.');

// Read app version from package.json for runtime reporting (profile/error logs)
const pkg = JSON.parse(
  readFileSync(path.resolve(__dirname, "./package.json"), "utf-8")
);

  // https://vite.dev/config/
  export default defineConfig(async () => ({
    plugins: [react(), tailwindcss()],

    // Load .env files from configs/env/ (matches .env.development / .env.production)
    envDir: path.resolve(__dirname, "./configs/env"),

    define: {
    __BUILD_DATE__: JSON.stringify(buildDate),
    __APP_VERSION__: JSON.stringify(pkg.version),
  },

  resolve: {
    alias: [
      { find: "@", replacement: path.resolve(__dirname, "./src") },
      {
        find: /^@tauri-apps\/.+/,
        replacement: path.resolve(__dirname, "./src/shared/lib/tauri-stub.ts"),
      },
    ],
  },

  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-antd': ['antd', '@ant-design/icons'],
          'vendor-echarts': ['echarts', 'echarts-for-react'],
          'vendor-charts': ['lightweight-charts'],
          'vendor-markdown': ['react-markdown', 'remark-gfm'],
          'vendor-syntax': ['react-syntax-highlighter'],
          'vendor-office': ['xlsx', 'jszip'],
        },
      },
    },
  },

  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    // Allow connections from both IPv4 and IPv6 localhost — some browsers
    // resolve localhost to ::1 first, and a strict bind to 127.0.0.1 causes
    // ERR_CONNECTION_REFUSED on OAuth callbacks.
    host: host || true,
    watch: {
      ignored: ["**/node_modules/**", "**/src-tauri/**"],
    },
  },
}));
