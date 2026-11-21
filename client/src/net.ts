import { Client } from "colyseus.js";

const protocol = location.protocol === "https:" ? "wss" : "ws";
export const client = new Client(`${protocol}://${location.hostname}:2567`);