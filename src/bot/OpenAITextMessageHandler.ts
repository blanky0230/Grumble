import { MumbleBot } from "./MumbleBot";
import { UserRepo } from "./UserRepo";

export class OpenAITextMessageHandler {
    private mumbleBot: MumbleBot;
    private userRepo: UserRepo;
    constructor(mumbleBot: MumbleBot, userRepo: UserRepo) {
        this.mumbleBot = mumbleBot;
        this.userRepo = userRepo;

        this.mumbleBot.on("TextMessage", (message) => {

            if(message.session?.includes(this.userRepo.getSelfId()!)) {
                mumbleBot.sendProtocolMessage("TextMessage", {
                    message: "Hello, I am a bot. I am currently under development.",
                    actor: userRepo.getSelfId()!,
                    session: [message.actor!],
                    channelId: [],
                    treeId: [],
                });
            }

            if(message.channelId?.includes(this.userRepo.get(this.userRepo.getSelfId()!)?.channelId!)) {
                mumbleBot.sendProtocolMessage("TextMessage", {
                    message: "Hello, I am a bot. I am currently under development.",
                    actor: userRepo.getSelfId()!,
                    session: [],
                    treeId: [],
                    // session: [message.actor!],
                    channelId: message.channelId!,
                });
            }
        });
    }

}