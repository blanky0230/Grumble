import { ChannelState } from "../generated/src/proto/Mumble_pb";
import { MumbleBot } from "./MumbleBot";

export class ChannelRepo {
    private channels: Map<number, ChannelState.AsObject>;
    private mumbleBot: MumbleBot;

    constructor(mumbleBot: MumbleBot) {
        this.channels = new Map<number, ChannelState.AsObject>();
        this.mumbleBot = mumbleBot;
        this.mumbleBot.on("ChannelState", (message) => {
            this.channels.set(message.channelId!, message);
        });
    }

    get(id: number): ChannelState.AsObject | undefined {
        return this.channels.get(id);
    }

    getAll(): ChannelState.AsObject[] {
        return Array.from(this.channels.values());
    }

    findByName(name: string): ChannelState.AsObject | undefined {
        return Array.from(this.channels.values()).find((channel) => channel.name === name);
    }
}