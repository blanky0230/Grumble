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
    private stream: DispatchStream;

    constructor(mumbleBot: MumbleBot) {
        this.mumbleBot = mumbleBot;
        this.audioPlayQueue = mumbleBot.getQueues().audioPlayQueue;
        this.runner = new MutexRunner();
        this.stream = new DispatchStream(this.mumbleBot, 0)
        this.stream.close();
        this.audioPlayQueue.on("enqueue", (task) => {
            this.runner.run(async () => await this.play(task));
        });
    }


    play(task: { file: string }, voiceTarget?: number): Promise<void> {
        return new Promise((resolve, reject) => {
            console.log(`Playing: ${task.file}`);
            this.stream.close();
            this.stream.open();

            const command = ffmpeg(task?.file)
                .output(this.stream)
                .audioFrequency(48000)
                .audioChannels(1)
                .format('s16le')
                .on('error', (e) => {
                    console.error(e);
                    reject(e);
                });

            this.stream.once('finish', () => {
                setTimeout(() => resolve(), 200);
            });

            command.run()
        });
    }
}