import { UserState } from "../generated/src/proto/Mumble_pb";
import { MumbleBot } from "./MumbleBot";

export class UserRepo {
    private users: Record<number, UserState.AsObject>;
    private mumbleBot: MumbleBot;
    private selfId?: number;

    constructor(mumbleBot: MumbleBot) {
        this.users = [];
        this.mumbleBot = mumbleBot;
        this.mumbleBot.on("UserState", (message) => {
            if(message.name === this.mumbleBot.options.username) {
                this.selfId = message.session;
            }
            this.users[message.session!] = message;
        });
        this.mumbleBot.on("UserRemove", (message) => {
            delete this.users[message.session!] 
        });
    }

    getSelfId(): number | undefined {
        return this.selfId;
    }

    getCurrentChannel(): number | undefined {
        if(!this.selfId) return undefined;
        return this.users[this.selfId].channelId;
    }

    get(id: number): UserState.AsObject | undefined {
        return this.users[id]
    }

    findByName(name: string): UserState.AsObject | undefined {
        return Object.values(this.users).find((user) => user.name?.toLowerCase() === name.toLowerCase());
    }

    listAllNames(): string[] {
        return Object.values(this.users).map((user) => user.name!);
    }

    all(): UserState.AsObject[] {
        return Object.values(this.users);
    }
}