import { defineConfig } from "vite";

export default defineConfig({
  server: {
    host: true, // expose on LAN so phones can join the party
    port: 5173
  },
  define: {
    global: "globalThis"
  }
});