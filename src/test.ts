import { AudioInputBuffer } from "./bot/AudioInputBuffer";
import { MumbleBot } from "./bot/MumbleBot";
import { Queue } from "./lib/Queue";
import dotenv from "dotenv"
import { AudioInput } from "./bot/types";
import { EventemittingQueue } from "./lib/EventEmittingQueue";
import { LangchainChatter } from "./ai/LangchainChatter";
import { ElevenlabsSpeech } from "./ai/ElevenlabsSpeech";
import { AudioPlayer } from "./bot/AudioPlayer";
import { TextSender } from "./bot/TextSender";
dotenv.config();

const username = "Harald";

async function main() {
  const client = new MumbleBot({
    host: process.env.MUMBLE_HOST || "localhost",
    port: process.env.MUMBLE_PORT ? parseInt(process.env.MUMBLE_PORT) : 64738,
    password: process.env.MUMBLE_PASSWORD || undefined,
    username,
    debug: false,
  });


  const chatter = new LangchainChatter(client);
  const elevenlabs = new ElevenlabsSpeech(client);
  const player = new AudioPlayer(client);
  const texter = new TextSender(client);
  await client.connect();
  client.gotoUser("Blanky-Nix");
}

main();