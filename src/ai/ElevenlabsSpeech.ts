import { EventemittingQueue } from "../lib/EventEmittingQueue";
import fs from "fs";
import axios from "axios";
import { MumbleBot } from "../bot/MumbleBot";
import { Queues } from "../bot/types";
import { join } from "path";

export class ElevenlabsSpeech {
    private audioGenerationQueue: Queues["audioGenerationQueue"];
    private audioPlayQueue: Queues["audioPlayQueue"]
    

    constructor(client: MumbleBot) {
        this.audioGenerationQueue = client.getQueues().audioGenerationQueue;
        this.audioPlayQueue = client.getQueues().audioPlayQueue;

        this.audioGenerationQueue.on("enqueue", async (item) => {
            const info = await this.onGenerateTask();
            setTimeout(() => this.audioPlayQueue.enqueue({ file: info.fileName, context: item.context, target: item.target }), 50);
        });
    }

    private async onGenerateTask(): Promise<{ status: string; fileName: string; }> {
        const item = this.audioGenerationQueue.deque();
        if(!item) {
            return { status: "error", fileName: "" };
        }
        const voiceId = process.env.ELEVENLABS_VOICE_ID ?? "ExHcCt3Fc4eiBjYgZOxY";
        const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;
        const response = await axios(url, {
            method: "POST",
            headers: {
                "accept": "audio/mpeg",
                "xi-api-key": process.env.ELEVENLABS_API_KEY || "",
                "Content-Type": "application/json",
            },
            data: {
                text: item.text,
                model_id: "eleven_monolingual_v1",
            },
            responseType: "stream",
        });

        const fileName = `${Date.now()}-output.mp3`
        response.data.pipe(fs.createWriteStream(join(process.env.AUDIO_OUTPUT_PATH!, fileName)));
        const writeStream = fs.createWriteStream(join(process.env.AUDIO_OUTPUT_PATH!,fileName));
        response.data.pipe(writeStream);

        return new Promise((resolve, reject) => {
            const responseJson = { status: "ok", fileName: join(process.env.AUDIO_OUTPUT_PATH!, fileName) };
            writeStream.on('close', () => resolve(responseJson));
            writeStream.on('error', reject);
          });
    }
}