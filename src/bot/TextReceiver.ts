import { TextMessage } from "../generated/src/proto/Mumble_pb";
import { MumbleBot } from "./MumbleBot";
import { TextInput } from "./types";

export class TextReceiver {
    private mumble: MumbleBot;

    constructor(mumble: MumbleBot) {
        this.mumble = mumble;
        this.mumble.on("TextMessage", (message) => {
            this._onTextMessage(message);
        });
    }

    private _onTextMessage(message: TextMessage.AsObject) {
        const inputQueue = this.mumble.getQueues().textInputQueue;
        if(message.actor === undefined) {
            return;
        }
        inputQueue.enqueue(message as TextInput);

    }
}