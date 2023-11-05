import { Tool, ToolParams } from "langchain/tools";
import { Queues } from "../bot/types";

export class SendChatMessageTool extends Tool {
    name = "sendChatMessage";
    description = "useful for when a user asks you to send a message. Usage: sendChatMessage <message>";

    private textSendQueue: Queues['textSendQueue'];

    static lc_name() {
        return "sendChatMessage";
    }

    get lc_namespace() {
        return [...super.lc_namespace, "sendChatMessage"];
    }

    constructor(fields: ToolParams & { textSendQueue: Queues['textSendQueue']}) {
        const { textSendQueue: textOutputQueue, ...args } = fields;
        super(args);
        this.textSendQueue = textOutputQueue;
    }

    async _call(arg: string): Promise<string> {
        if (!arg.length) {
            return "Please provide a message to send!"
        }
        this.textSendQueue.enqueue({ message: arg });
        return `Message ${arg} successfully sent.`;
    }

}