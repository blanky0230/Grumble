import { ChatOpenAI } from "langchain/chat_models/openai";
import { OpenAI } from "langchain/llms/openai";
import { AgentExecutor, ChatAgentOutputParser, ChatConversationalAgent, initializeAgentExecutorWithOptions } from "langchain/agents";
import { OpenAIWhisperAudio } from "langchain/document_loaders/fs/openai_whisper_audio";
import { ChatPromptTemplate, PromptTemplate, SystemMessagePromptTemplate } from "langchain/prompts";
import fs from "fs";
import { formatLogToString } from "langchain/agents/format_scratchpad/log";
import { execSync } from "child_process";
import { Queues } from "../bot/types";
import { BufferMemory } from "langchain/memory"
import { SerpAPI } from "langchain/tools"
import { Calculator } from "langchain/tools/calculator"
import dotenv from "dotenv";
import { join } from "path";
import { renderTextDescription } from "langchain/tools/render";
import { RunnableSequence } from "langchain/schema/runnable";
import { AgentStep, BaseMessage } from "langchain/schema";
import { StringOutputParser } from "langchain/schema/output_parser";
import { SendChatMessageTool } from "./SendChatMessageTool";
import { UserRepo } from "../bot/UserRepo";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { WebBrowser } from "langchain/tools/webbrowser";
import { MumbleBot } from "../bot/MumbleBot";
dotenv.config();

export class LangchainChatter {
    private username: string;
    private queues: Queues;
    private userRepo: UserRepo;

    constructor(client: MumbleBot) {
        this.username = client.options.username;
        this.queues = client.getQueues();
        this.userRepo = client.users;

        this._setupAgent().then((executor) => {
            this.queues.audioInputQueue.on("enqueue", () => {
                try {
                    this.onAudio(executor)
                } catch (e: any) {
                    this.queues.textSendQueue.enqueue({ message: e.message });
                }
            });
        });
    }

    private async _setupAgent(): Promise<AgentExecutor> {
        const tools = [
            new SerpAPI(process.env.SERPAPI_API_KEY, {
                hl: "de",
                gl: "de",
            }),
            new Calculator(),
            new SendChatMessageTool({ textSendQueue: this.queues.textSendQueue }),
            new WebBrowser({model: new OpenAI({temperature: 0}), embeddings: new OpenAIEmbeddings()}),
        ];

        const toolPrompt = fs.readFileSync(join(__dirname, 'toolprompt.txt'), 'utf8');
        const toolNames = tools.map((tool) => tool.name);

        const promptTemplate = ChatPromptTemplate.fromMessages(
            [
                SystemMessagePromptTemplate.fromTemplate(toolPrompt),
                ['human', 'Question: {input}']
            ]
        );


        const memory = new BufferMemory(
            {
                returnMessages: true,
                inputKey: "input",
                outputKey: "output",
                memoryKey: "chat_history",
            }
        );

        const model = new ChatOpenAI({modelName:'gpt-4', temperature: 0 });
        const agent = ChatConversationalAgent.fromLLMAndTools(model, tools);
        const executor = AgentExecutor.fromAgentAndTools({
            agent: agent,
            tools,
            memory: memory,
            verbose: true,
            maxIterations: 200,
        });

        return executor;
    }

    public async onAudio(executor: AgentExecutor) {
        const job = this.queues.audioInputQueue.deque();
        if (!job) {
            return;
        }
        if (!this.isAudioProcessable(job.file)) {
            // this.removeFile(job.file);
            return;
        }


        const whisperDocument = await this.getWhisperDocument(job.file).load();
        if (!whisperDocument) {
            console.error(`Could not load whisper document for ${job.file}`);
            // this.removeFile(job.file);
            return;
        }
        console.debug(`WHISPER DOCUMENT: ${JSON.stringify(whisperDocument)}`);

        const nameTemplate = `
            Your name is ${this.username}. The given sentence is a transcription of some person's speech. By the nature of these Transscriptions, they are not always correct.
            So a person may have tried to address you, but the Transscription may have gotten your name wrong, cluttered your name with noise, or may have understood completely different words.
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
            `Given a sentence correct the spelling. Weed out any words that are not in the dictionary for either German or English. If the sentence is already correct, just reply with the sentence.
        sentence: {grammar_sentence}
        sentence with correct spelling:
        `

        const spellingPrompt = PromptTemplate.fromTemplate(spellingTemplate)
        const llm = new ChatOpenAI({});

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

        const text = whisperDocument
            .filter((d) => d.pageContent?.includes(this.username))
            .map((d) => d.pageContent)
            .map((d) => d.trim())
            .join("\n");


        if (text.length < 2) {
            console.debug(`No text found in whisper document for ${job.file}`);
            // this.queues.textSendQueue.enqueue({ message: "Ich habe nichts verstanden." });
            return;
        }

        const queryText = await repairChain.invoke({ raw_sentence: text });
        console.log(`REPAIRED INPUT: ${queryText}`);

        let output;
        const initiator = this.userRepo.get(job.senderSession);
        try {
            this.queues.textSendQueue.enqueue({ message: `${initiator?.name!}: Ich denke nach...` });
            // output = await executor.call({ input: { query: queryText, username: initiator?.name! } });
            output = await executor.call({ input: `Agent name is: ${this.username}.\n User name is ${this.username}.\nQuestion: ${queryText}` });
        } catch (e: any) {
            console.error(`Error running agent: ${e.message}`);
            if (!e?.message?.startsWith('Error Could not parse LLM output: ')) {
                throw e;
            }
            output = { output: e.message.replace('Error Could not parse LLM output: ', '') };
        }

        const result: string = output.output;
        if (result.length > 120) {
            this.queues.textSendQueue.enqueue({ message: result });
        } else {
            this.queues.audioGenerationQueue.enqueue({ target: initiator?.session!, context: job.context, text: result });
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