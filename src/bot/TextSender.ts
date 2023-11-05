import { TextMessage } from "../generated/src/proto/Mumble_pb";
import { MumbleBot } from "./MumbleBot";

export class TextSender {
    private mumble: MumbleBot;

    constructor(mumble: MumbleBot) {
        this.mumble = mumble;
        this.mumble.getQueues().textSendQueue.on("enqueue", (message) => {
            this._onTextMessage(message);
        });
    }

    private _onTextMessage(message: TextMessage.AsObject) {
        let toSend = {...message};

        if(toSend.message === undefined) {
            toSend.message = "No Text given?";
        }
        
        if(toSend.channelId === undefined) {
            console.debug(`No explicit channel given, sending to current channel`);
            toSend.channelId = [this.mumble.users.get(this.mumble.users.getSelfId()!)!.channelId!];
        }

        if(toSend.actor === undefined) {
            console.debug(`No explicit actor given, sending as self`);
            toSend.actor = this.mumble.users.getSelfId()!;
        }

        this.mumble.sendProtocolMessage("TextMessage", toSend);
        console.log(`Sent: ${JSON.stringify(this.mumble.getQueues().textSendQueue.deque())}`);
    }
}