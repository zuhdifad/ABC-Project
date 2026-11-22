import { Client } from "colyseus.js";

const protocol = location.protocol === "https:" ? "wss" : "ws";
export const client = new Client(`${protocol}://${location.hostname}:2567`);

// dev handle: the verification harness probes room creation from the page
if (import.meta.env.DEV) {
  (window as any).__net = { client, url: `${protocol}://${location.hostname}:2567` };
}