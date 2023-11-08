import { EventemittingQueue } from "../lib/EventEmittingQueue";
import { MutexRunner } from "../lib/MutexRunner";
import { DispatchStream } from "./DispatchStream";
import { MumbleBot } from "./MumbleBot";
import ffmpeg from "fluent-ffmpeg";
import { Queues } from "./types";

export class AudioPlayer {

    private mumbleBot: MumbleBot;
    private audioPlayQueue: Queues["audioPlayQueue"];
    private runner: MutexRunner;
    constructor(mumbleBot: MumbleBot) {
        this.mumbleBot = mumbleBot;
        this.audioPlayQueue = mumbleBot.getQueues().audioPlayQueue;
        this.runner = new MutexRunner();
        this.audioPlayQueue.on("enqueue", (task) => {
            this.runner.run(async () => await this.play(task));
        });
    }


    play(task: { file: string }, voiceTarget?: number): Promise<void> {
        const stream = new DispatchStream(this.mumbleBot, voiceTarget || 0);
        return new Promise((resolve, reject) => {
            console.log(`Playing: ${task.file}`);

            const command = ffmpeg(task?.file)
                .output(stream)
                .audioFrequency(48000)
                .audioChannels(1)
                .format('s16le')
                .on('error', (e) => {
                    console.error(e);
                    reject(e);
                })
                stream.once('finish', () => {
                    setTimeout(() => resolve(), 20);
                });
                stream.on('error', (e) => {
                    reject(e);
                });
            command.run()
        });
    }
}