import { EventemittingQueue } from "../lib/EventEmittingQueue";
import fs from "fs";
import axios from "axios";
import { MumbleBot } from "../bot/MumbleBot";
import { Queues } from "../bot/types";

export class ElevenlabsSpeech {
    private audioGenerationQueue: Queues["audioGenerationQueue"];
    private audioPlayQueue: Queues["audioPlayQueue"]
    

    constructor(client: MumbleBot) {
        this.audioGenerationQueue = client.getQueues().audioGenerationQueue;
        this.audioPlayQueue = client.getQueues().audioPlayQueue;

        this.audioGenerationQueue.on("enqueue", async (item) => {
            const info = await this.onGenerateTask();
            setTimeout(() => this.audioPlayQueue.enqueue({ file: info.fileName, context: item.context, target: item.target }), 300);
        });
    }

    private async onGenerateTask(): Promise<{ status: string; fileName: string; }> {
        const item = this.audioGenerationQueue.deque();
        if(!item) {
            return { status: "error", fileName: "" };
        }
        const voiceId = "ExHcCt3Fc4eiBjYgZOxY";
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
        response.data.pipe(fs.createWriteStream(fileName));
        const writeStream = fs.createWriteStream(fileName)
        response.data.pipe(writeStream);

        return new Promise((resolve, reject) => {
            const responseJson = { status: "ok", fileName: fileName };
            writeStream.on('finish', () => resolve(responseJson));
          
            writeStream.on('error', reject);
          });
    }
}