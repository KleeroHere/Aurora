import { existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vite";
import type { Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { nodePolyfills } from "vite-plugin-node-polyfills";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

/**
 * The splash video source (2560x1440 HEVC, ~16 MB) sits in public/ next to the
 * transcoded intro.webm (VP9, primary) and intro.mp4 (H.264, fallback), because
 * that is the convenient place to drop the file — but Vite copies everything in
 * public/ into dist/ verbatim. The app only ever uses the transcodes, so the
 * source would add ~16 MB to the package for nothing. It is deleted from dist
 * after the build; public/ itself is left alone.
 */
function excludeIntroSourceFromBuild(): Plugin {
  return {
    name: "exclude-intro-source-from-build",
    apply: "build",
    closeBundle() {
      // @ts-expect-error process/__dirname are nodejs globals, available in a Vite config
      const distPath = resolve(process.cwd(), "dist/brand/intro-source.mp4");
      if (existsSync(distPath)) {
        rmSync(distPath);
      }
    },
  };
}

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [
    react(),
    // PouchDB (pouchdb-core) extends Node's EventEmitter ("events"). By default
    // Vite merely externalises such Node modules for the browser, without a real
    // implementation — and then `class Changes extends EE` dies at runtime with
    // "Class extends value [object Object] is not a constructor".
    // This plugin substitutes an actual browser polyfill of "events".
    nodePolyfills({ include: ["events"] }),
    excludeIntroSourceFromBuild(),
  ],

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));
