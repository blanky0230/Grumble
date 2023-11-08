import { MumbleBot } from "./bot/MumbleBot";
import dotenv from "dotenv"
import { LangchainChatter } from "./ai/LangchainChatter";
import { ElevenlabsSpeech } from "./ai/ElevenlabsSpeech";
import { AudioPlayer } from "./bot/AudioPlayer";
import { TextSender } from "./bot/TextSender";
import { TextReceiver } from "./bot/TextReceiver";
import { AudioInputBuffer } from "./bot/AudioInputBuffer";
import { AudioReceiver } from "./bot/AudioReceiver";
dotenv.config();

const username = "Axel";

async function main() {
  const client = new MumbleBot({
    host: process.env.MUMBLE_HOST || "localhost",
    port: process.env.MUMBLE_PORT ? parseInt(process.env.MUMBLE_PORT) : 64738,
    password: process.env.MUMBLE_PASSWORD || undefined,
    username,
    debug: false,
  });


  //Enables the "Bot" to send and receive text messages
  new TextReceiver(client);
  new TextSender(client);

  //Enables the "Bot" to send and receive audio
  new AudioPlayer(client);
  new AudioInputBuffer(new AudioReceiver(client), client);

  //Actual "AI" stuff
  new LangchainChatter(client);
  new ElevenlabsSpeech(client);
  await client.connect();
}

main();
