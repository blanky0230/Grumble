import { Stream } from "stream";
import { MumbleBot } from "./MumbleBot";
import EventEmitter from "node:events";

export class DispatchStream extends Stream.Writable {
    private mumbleBot: MumbleBot;
    private voiceTarget: number;
    private processObserver: EventEmitter;
    private frameQueue: Array<Buffer>;
    private lastFrame: Buffer;
    private _volume: number;
    private lastFrameWritten: number;
    private lastWrite: number | null;
    private processInterval: NodeJS.Timer | null;
    private voiceSequence: number;

    constructor(mumbleBot: MumbleBot, voiceTarget: number) {
        super()
        this.mumbleBot = mumbleBot;
        this.voiceSequence = mumbleBot.voiceOutputSequence;
        this.voiceTarget = voiceTarget;

        this.processObserver = new EventEmitter()


        this.frameQueue = [];
        this.lastFrame = this._createFrameBuffer()

        this._volume = 1
        this.lastFrameWritten = 0
        this.lastWrite = null
        this.processInterval = null;
    }

    open(): NodeJS.Timer {
        if (this.processInterval) return this.processInterval;

        return setInterval(() =>
            this._processAudioBuffer(),
            10
        );
    }

    close() {
        if (this.processInterval) clearInterval(this.processInterval)
        this.processInterval = null
        this.frameQueue = []
        this.lastFrame = this._createFrameBuffer()
        this.lastFrameWritten = 0
        this.lastWrite = null
    }

    reset() {
        this.close();
        this.open();
    }

    set volume(volume) {
        this._volume = volume;
    }

    get volume() {
        return this._volume
    }

    applyFrameVolume(frame: Buffer, gain: number) {
        for (var i = 0; i < frame.length; i += 2) {
            frame.writeInt16LE(Math.floor(frame.readInt16LE(i) * gain), i);
        }
        return frame;
    }

    _createFrameBuffer() {
        return Buffer.alloc(480 * 2);
    }

    _processAudioBuffer() {
        if (!this.lastWrite ||
            this.lastWrite + 20 * 10 < Date.now()) {
            this.voiceSequence = this.mumbleBot.voiceOutputSequence
            this.lastWrite = Date.now()
            return
        }

        while (this.lastWrite + 10 < Date.now()) {
            if (this.frameQueue.length > 0) {
                let frame = this.frameQueue.shift();
                if (!frame) {
                    console.error("Frame is undefined");
                    continue;
                }

                if (this._volume !== 1) {
                    frame = this.applyFrameVolume(frame, this._volume);
                }

                if (this.frameQueue.length < 1) {
                    this.voiceSequence += this.mumbleBot.writeAudio(
                        frame,
                        this.voiceTarget,
                        4,
                        this.voiceSequence,
                        true
                    )
                } else {
                    this.voiceSequence += this.mumbleBot.writeAudio(
                        frame,
                        this.voiceTarget,
                        4,
                        this.voiceSequence,
                        false
                    )
                }
                this.processObserver.emit('written')
            }

            this.lastWrite += 10;
        }

        return
    }


    _write(chunk: any, encoding: BufferEncoding, callback: (error?: Error | null) => void): void {
        while (true) {
            if (this.frameQueue.length >= 10) {
                this.processObserver.once('written', () => {
                    this._write(chunk, encoding, callback)
                })
                return
            }

            const writtenBefore = this.lastFrameWritten
            chunk.copy(this.lastFrame, this.lastFrameWritten, 0)
            let written = writtenBefore + chunk.length

            if (written >= this.lastFrame.length) {
                written = this.lastFrame.length
                this.frameQueue.push(this.lastFrame)
                this.lastFrame = this._createFrameBuffer()
                this.lastFrameWritten = 0
            } else {
                this.lastFrameWritten = written
            }

            if (chunk.length > (written - writtenBefore)) {
                chunk = chunk.slice(written - writtenBefore)
            } else {
                return callback()
            }
        }
    }
}