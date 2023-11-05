import { Audio } from "../generated/src/proto/MumbleUDP_pb";
import fs from "fs";
import { AudioReceiver } from "./AudioReceiver";
import { OpusEncoder } from "@discordjs/opus";
import { exec } from "child_process";
import { Queues } from "./types";



export class AudioInputBuffer {
    private activeForUsers: Map<number, Buffer>;
    private receiver: AudioReceiver;
    private encoder: OpusEncoder;
    private audioInputQueue: Queues["audioInputQueue"];


    constructor(receiver: AudioReceiver, audioInputQueue: Queues["audioInputQueue"]) {
        this.receiver = receiver;
        this.audioInputQueue = audioInputQueue;
        this.activeForUsers = new Map<number, Buffer>();
        this.encoder = new OpusEncoder(48000, 1);

        this.receiver.on("Audio", (audio) => {
            this._appendAudio(audio);
        });
    }

    private _appendAudio(audio: Audio.AsObject) {
        const newBuf = Buffer.concat([this.activeForUsers.get(audio.senderSession) ?? Buffer.from([]), this.encoder.decode(audio.opusData)]);
        this.activeForUsers.set(audio.senderSession, newBuf);
        if (audio.isTerminator) {
            const name = `${audio.senderSession}-${Date.now()}`;
            const rawFile = `${name}.pcm`;
            const wavFile = `${name}.wav`;
            fs.writeFileSync(`${name}.pcm`, newBuf, { encoding: 'binary' });
            exec(`ffmpeg -f s16le -ar 48000 -ac 1 -i ${rawFile} ${wavFile} -y`).addListener('exit', (code, signal) => {
                this.activeForUsers.delete(audio.senderSession);
                fs.unlinkSync(`${name}.pcm`);
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