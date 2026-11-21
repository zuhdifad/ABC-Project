import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "colyseus";
import { RaceRoom } from "./rooms/RaceRoom";

const app = express();
app.use(cors());
app.use(express.json());

const gameServer = new Server({ server: createServer(app) });
gameServer.define("race", RaceRoom);

gameServer.listen(2567).then(() => {
  console.log("Mash Party server listening on ws://localhost:2567");
});