import { ChatOpenAI } from "langchain/chat_models/openai";
import { OpenAI } from "langchain/llms/openai";
import { AgentExecutor, ChatConversationalAgent } from "langchain/agents";
import { OpenAIWhisperAudio } from "langchain/document_loaders/fs/openai_whisper_audio";
import { PromptTemplate } from "langchain/prompts";
import fs from "fs";
import { execSync } from "child_process";
import { AudioInput, Queues, TextInput } from "../bot/types";
import { BufferMemory } from "langchain/memory"
import { DynamicTool, SerpAPI } from "langchain/tools"
import { Calculator } from "langchain/tools/calculator"
import dotenv from "dotenv";
import { RunnableSequence } from "langchain/schema/runnable";
import { StringOutputParser } from "langchain/schema/output_parser";
import { UserRepo } from "../bot/UserRepo";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { WebBrowser } from "langchain/tools/webbrowser";
import { MumbleBot } from "../bot/MumbleBot";
import { TextMessage } from "../generated/src/proto/Mumble_pb";
dotenv.config();

export class LangchainChatter {
    private client: MumbleBot;
    private username: string;
    private queues: Queues;
    private userRepo: UserRepo;
    private executor: AgentExecutor;
    private repairFromAudioChain: RunnableSequence;

    constructor(client: MumbleBot) {
        this.client = client;
        this.username = client.options.username;
        this.queues = client.getQueues();
        this.userRepo = client.users;
        this.executor = this._setupAgent();
        this.repairFromAudioChain = this._setupRepairFromAudioChain();

        this.queues.audioInputQueue.on("enqueue", (job) => {
            try {
                this.onAudio(job)
            } catch (e: any) {
                this.queues.textSendQueue.enqueue({ message: e.message, isError: true });
            }
        });

        this.queues.textInputQueue.on("enqueue", (job) => {
            try {
                this.onText(job);
            } catch (e: any) {
                this.queues.textSendQueue.enqueue({ message: e.message, isError: true });
            }
        });
    }

    private _setupAgent(): AgentExecutor {
        const tools = [
            new SerpAPI(process.env.SERPAPI_API_KEY, {
                hl: "de",
                gl: "de",
            }),
            new WebBrowser({ model: new OpenAI({ temperature: 0 }), embeddings: new OpenAIEmbeddings() }),
            new Calculator(),
            new DynamicTool({
                name: "sayTo",
                description: "Say something. Useful if someone asks you to say something to someone. Usage: say <something>",
                func: async (input) => {
                    this.queues.audioGenerationQueue.enqueue({ context: 0, target: 0, text: input });
                    return input;
                }
            }),
            ...this.client.generateTools(),
        ];

        const memory = new BufferMemory(
            {
                returnMessages: true,
                inputKey: "input",
                outputKey: "output",
                memoryKey: "chat_history",
            }
        );

        const model = new ChatOpenAI({ modelName: 'gpt-4', temperature: 0 });
        const agent = ChatConversationalAgent.fromLLMAndTools(model, tools, { systemMessage: '' });
        const executor = AgentExecutor.fromAgentAndTools({
            agent: agent,
            tools,
            memory: memory,
            verbose: true,
        });

        return executor;
    }


    private _setupRepairFromAudioChain(): RunnableSequence<any, any> {
        const nameTemplate = `
            Your name is ${this.username}. The given sentence is a transcription of some person's speech. By the nature of these transscriptions, they are not always correct.
            So a person may have tried to address you, but the transscription may have gotten your name wrong, cluttered your name with noise, or may have understood completely different words.
            Try to find your name in the text and correct it. Your name may be splitt accross multiple words, so try to "phonetically" find your name.
            If the sentence is already correct, just reply with the sentence.
            sentence: {raw_sentence}
            sentence with correct name:
        `

        const grammarTemplate =
            `Given a sentence correct the grammar. If the sentence is already correct, just reply with the sentence.
        sentence: {punctuated_sentence}
        sentence with correct grammar: 
        `
        const grammarPrompt = PromptTemplate.fromTemplate(grammarTemplate)

        const spellingTemplate =
            `Given a sentence correct the spelling. If the sentence is already correct, just reply with the sentence.
        sentence: {grammar_sentence}
        sentence with correct spelling:
        `

        const spellingPrompt = PromptTemplate.fromTemplate(spellingTemplate)
        const llm = new OpenAI({ temperature: 0 });

        const repairChain = RunnableSequence.from([
            PromptTemplate.fromTemplate(nameTemplate),
            llm,
            new StringOutputParser(),
            {
                punctuated_sentence: (i) => i,
            },
            grammarPrompt,
            llm,
            new StringOutputParser(),
            {
                grammar_sentence: (i) => i,
            },
            spellingPrompt,
            llm,
            new StringOutputParser(),
        ]);

        return repairChain;
    }

    private async onAudio(job: AudioInput) {

        if (!this.isAudioProcessable(job.file)) {
            this.removeFile(job.file);
            return;
        }


        const whisperDocument = await this.getWhisperDocument(job.file).load();
        if (!whisperDocument) {
            console.error(`Could not load whisper document for ${job.file}`);
            this.removeFile(job.file);
            return;
        }

        const text = whisperDocument
            .filter((d) => d.pageContent?.toLowerCase().includes(this.username.toLowerCase()))
            .map((d) => d.pageContent)
            .map((d) => d.trim())
            .join("\n");

        if (!text.length) {
            console.debug(`No text found in whisper document for ${job.file}`);
            this.removeFile(job.file);
            return;
        }

        const queryText = await this.repairFromAudioChain.invoke({ raw_sentence: text });
        const initiator = this.userRepo.get(job.senderSession);
        try {
            this.queues.textSendQueue.enqueue({ message: `${initiator?.name!}: Ich denke nach...` });
            const output = await this.executor.call({ input: `Assistant name is: ${this.username}.\n User name is ${initiator?.name}.\nUser Session is ${job.senderSession}\nQuestion: ${queryText}` });
            const result: string = output.output;
            this.queues.audioGenerationQueue.enqueue({ target: initiator?.session!, context: job.context, text: result });
        } catch (e: any) {
            this.queues.textSendQueue.enqueue({ message: e.message, isError: true });
        } finally {
            this.removeFile(job.file);
        }

    }

    private async onText(job: TextInput) {
        let messageTemplate: TextMessage.AsObject | undefined = undefined;
        if (job.session?.includes(this.userRepo.getSelfId()!)) {
            messageTemplate = { session: [job.actor] };
        }
        else if (job.channelId?.includes(this.userRepo.getCurrentChannel() ?? 0)) {
            messageTemplate = { channelId: job.channelId };
        } else {
            console.debug(`Message not for me`);
            return;
        }
        const initiator = this.userRepo.get(job.actor);
        try {
            this.queues.textSendQueue.enqueue({ ...messageTemplate, message: `${initiator?.name!}: Ich denke nach...` });
            const output = await this.executor.call({ input: `Assistant name is: ${this.username}.\n User name is ${initiator?.name}.\nUser Session is ${job.actor}\nQuestion: ${job.message}` });
            const result: string = output.output;
            this.queues.textSendQueue.enqueue({ ...messageTemplate, message: result });
        } catch (e: any) {
            this.queues.textSendQueue.enqueue({ message: e.message, isError: true });
        }
    }

    private getWhisperDocument(file: string): OpenAIWhisperAudio {
        return new OpenAIWhisperAudio(file);
    }

    private isAudioProcessable(file: string): boolean {
        const ffProbe = execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 ${file}`);
        const duration = parseFloat(ffProbe.toString('utf8'));
        if (duration < 1) {
            return false;
        }
        return true;
    }

    private removeFile = fs.unlinkSync
}