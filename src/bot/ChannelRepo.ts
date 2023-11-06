import { ChannelState } from "../generated/src/proto/Mumble_pb";
import { MumbleBot } from "./MumbleBot";

export class ChannelRepo {
    private channels: Record<number, ChannelState.AsObject>;
    private mumbleBot: MumbleBot;

    constructor(mumbleBot: MumbleBot) {
        this.channels = [];
        this.mumbleBot = mumbleBot;
        this.mumbleBot.on("ChannelState", (message) => {
            this.channels[message.channelId!] = message
        });
    }

    get(id: number): ChannelState.AsObject | undefined {
        return this.channels[id]
    }

    getAll(): ChannelState.AsObject[] {
        return Object.values(this.channels);
    }

    findByName(name: string): ChannelState.AsObject | undefined {
        return Object.values(this.channels).find((channel) => channel.name?.toLowerCase() === name.toLowerCase());
    }
}