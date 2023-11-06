import { UserState } from "../generated/src/proto/Mumble_pb";
import { MumbleBot } from "./MumbleBot";

export class UserRepo {
    private users: Map<number, UserState.AsObject>;
    private mumbleBot: MumbleBot;
    private selfId?: number;

    constructor(mumbleBot: MumbleBot) {
        this.users = new Map<number, UserState.AsObject>();
        this.mumbleBot = mumbleBot;
        this.mumbleBot.on("UserState", (message) => {
            if(message.name === this.mumbleBot.options.username) {
                this.selfId = message.session;
            }

            if(!this.users.has(message.session!)) {
                this.users.set(message.session!, message);
            } else {
                this.users.get(message.session!)!.channelId = message.channelId;
            }
        });
        this.mumbleBot.on("UserRemove", (message) => {
            if(this.users.has(message.session!)) {
                this.users.delete(message.session!);
            }
        });
    }

    getSelfId(): number | undefined {
        return this.selfId;
    }

    getCurrentChannel(): number | undefined {
        return this.users.get(this.selfId!)?.channelId;
    }

    get(id: number): UserState.AsObject | undefined {
        return this.users.get(id);
    }

    findByName(name: string): UserState.AsObject | undefined {
        return Array.from(this.users.values()).find((user) => user.name?.toLowerCase() === name.toLowerCase());
    }

    listAllNames(): string[] {
        return Array.from(this.users.values()).map((user) => user.name!);
    }

    all(): UserState.AsObject[] {
        return Array.from(this.users.values());
    }
}