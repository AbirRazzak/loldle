import { defineConfig } from "vite";

export default defineConfig({
  base: "./", // relative asset paths: works at a GitHub Pages /repo/ subpath and behind Discord's proxy
  envDir: ".",
  server: {
    allowedHosts: [".trycloudflare.com"], // cloudflared tunnel used for testing inside Discord
  },
});
