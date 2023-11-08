import { Audio } from "../generated/src/proto/MumbleUDP_pb";
import fs from "fs";
import { AudioReceiver } from "./AudioReceiver";
import { OpusEncoder } from "@discordjs/opus";
import { exec } from "child_process";
import { Queues } from "./types";
import { join } from "path";
import { MumbleBot } from "./MumbleBot";



export class AudioInputBuffer {
    private activeForUsers: Map<number, Buffer>;
    private receiver: AudioReceiver;
    private encoder: OpusEncoder;
    private audioInputQueue: Queues["audioInputQueue"];
    private audioInputPath: string;


    constructor(receiver: AudioReceiver, client: MumbleBot) {
        this.receiver = receiver;
        this.audioInputQueue = client.getQueues().audioInputQueue;
        this.activeForUsers = new Map<number, Buffer>();
        this.encoder = new OpusEncoder(48000, 1);
        this.audioInputPath = this._ensureDirectory();

        this.receiver.on("Audio", (audio) => {
            this._appendAudio(audio);
        });
    }

    private _ensureDirectory(): string {
        const path = process.env.AUDIO_INPUT_PATH || undefined;
        if(!path) {
            throw new Error(`AUDIO_INPUT_PATH not set!`);
        }

        if(!fs.existsSync(path) || !fs.lstatSync(path).isDirectory()) {
            fs.mkdirSync(path, {recursive: true});
        }

        const out = process.env.AUDIO_OUTPUT_PATH || undefined;
        if(!out) {
            throw new Error(`AUDIO_OUTPUT_PATH not set!`);
        }

        if(!fs.existsSync(out) || !fs.lstatSync(out).isDirectory()) {
            fs.mkdirSync(out, {recursive: true});
        }

        return path;
    }

    private _appendAudio(audio: Audio.AsObject) {
        const newBuf = Buffer.concat([this.activeForUsers.get(audio.senderSession) ?? Buffer.from([]), this.encoder.decode(audio.opusData)]);
        this.activeForUsers.set(audio.senderSession, newBuf);
        if (audio.isTerminator) {
            const name = `${audio.senderSession}-${Date.now()}`;
            const rawFile = join(this.audioInputPath, `${name}.pcm`);
            const wavFile = join(this.audioInputPath, `${name}.wav`);
            fs.writeFileSync(rawFile, newBuf, { encoding: 'binary' });
            exec(`ffmpeg -f s16le -ar 48000 -ac 1 -i ${rawFile} ${wavFile} -y`).addListener('exit', (code, signal) => {
                this.activeForUsers.delete(audio.senderSession);
                fs.unlinkSync(rawFile);
                if (code === 0) {
                    this.audioInputQueue.enqueue({ file: wavFile, context: audio.context, senderSession: audio.senderSession });
                } else {
                    console.error(`ffmpeg exited with code ${code}, ${signal}`);
                }
            }).addListener('spawn', () => {
                //console.debug(`ffmpeg spawned`);
            });
        }
    }
}