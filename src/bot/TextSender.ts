import { TextMessage } from "../generated/src/proto/Mumble_pb";
import { MumbleBot } from "./MumbleBot";
import { TextOutput } from "./types";

export class TextSender {
    private mumble: MumbleBot;

    constructor(mumble: MumbleBot) {
        this.mumble = mumble;
        this.mumble.getQueues().textSendQueue.on("enqueue", () => {
            const message = this.mumble.getQueues().textSendQueue.deque();
            if(message) this._onTextMessage(message);
        });
    }

    private currentChannel(): number {
        return this.mumble.users.get(this.mumble.users.getSelfId()!)!.channelId!;
    }

    private _onTextMessage(message: TextOutput) {

        if(message.isError) {
            const send = {...message};
            delete send.isError;
            this.mumble.sendProtocolMessage("TextMessage", send);
            return;
        }

        if(message.channelId === undefined && message.session === undefined) {
            console.error(JSON.stringify(message));
            console.error(`No explicit channel or recipient! Message will not be sent!`);
            return;
        }

        if(message.actor === undefined) {
            console.debug(`No explicit actor given, sending as self`);
            message.actor = this.mumble.users.getSelfId()!;
        }

        this.mumble.sendProtocolMessage("TextMessage", message);
    }
}