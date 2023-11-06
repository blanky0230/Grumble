import {
  MessageStringToType,
  TCPMessage,
  TCPMessageTypeStrings,
  toType,
  toTypeNumber,
  toVarint,
} from "../proto/ProtoExtras";
import type { ConnectionOptions, TLSSocket } from "tls";
import { UserRepo } from "./UserRepo";
import tls from "tls";
import { TypedEventEmitter } from "../lib/TypedEventEmitter";
import path from "path";
import * as protobuf from "protobufjs";
import { ChannelRepo } from "./ChannelRepo";
import { OpusEncoder } from "@discordjs/opus";
import { EventemittingQueue } from "../lib/EventEmittingQueue";
import { AudioGeneration, AudioInput, AudioOutput, Queues, TextInput, TextOutput } from "./types";
import { AudioInputBuffer } from "./AudioInputBuffer";
import { AudioReceiver } from "./AudioReceiver";
import { TextReceiver } from "./TextReceiver";
import { DynamicTool, Tool } from "langchain/tools";

type ConnectOptions = {
  port: number;
  protobufPath?: string;
  host?: string;
  rejectUnauthorized?: boolean;
  options?: ConnectionOptions;
};


export type Options = ConnectOptions & {
  debug?: boolean;
  username: string;
  password?: string;
};

export class MumbleBot extends TypedEventEmitter<MessageStringToType> {
  //TODO: UDP
  private tcpSocket?: TLSSocket;
  private protoBuf?: protobuf.Root;
  private pingInterval?: NodeJS.Timer;
  private opus: OpusEncoder;
  private queues: Queues;
  private audioReceiver: AudioReceiver;
  private audioInputBuffer: AudioInputBuffer;
  private textReceiver: TextReceiver;
  public readonly options: Options;
  public users: UserRepo;
  public channels: ChannelRepo;
  public voiceOutputSequence: number;


  constructor(options: Options) {
    super();
    this.users = new UserRepo(this);
    this.channels = new ChannelRepo(this);
    this.voiceOutputSequence = 0;
    this.opus = new OpusEncoder(48000, 1);

    if (!options.protobufPath) {
      options.protobufPath = path.join(
        __dirname,
        "..",
        "proto",
        "Mumble.proto"
      );
    }

    this.options = options;
    this._setupProtobuf();
    this.queues = {
      //Inputs
      audioInputQueue: new EventemittingQueue<AudioInput>(),
      textInputQueue: new EventemittingQueue<TextInput>(),
      //Intermediate
      audioGenerationQueue: new EventemittingQueue<AudioGeneration>(),
      //Outputs
      textSendQueue: new EventemittingQueue<TextOutput>(),
      audioPlayQueue: new EventemittingQueue<AudioOutput>(),
    };

    this.audioReceiver = new AudioReceiver(this);
    this.textReceiver = new TextReceiver(this);

    this.audioInputBuffer = new AudioInputBuffer(this.audioReceiver, this.queues.audioInputQueue);

  }

  connect(): Promise<MumbleBot> {
    return new Promise((resolve, reject) => {
      this.tcpSocket = tls.connect(
        this.options.port,
        this.options.host,
        { ...this.options.options, rejectUnauthorized: false },
        () => {
          this._authenticate();
        }
      );
      this.tcpSocket.on("data", (data) => this._onDataReceived(data));
      this.on("ServerSync", () => resolve(this));
    });
  }

  public sendProtocolMessage<T extends keyof MessageStringToType>(
    type: T,
    message: MessageStringToType[T]
  ) {
    this._sendTCPMessage(type, message);
  }

  private _enablePing() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }

    this.pingInterval = setInterval(() => {
      this.sendProtocolMessage("Ping", { timestamp: Date.now() });
    }, 15000);
  }

  private async _onDataReceived(data: Buffer) {
    this._parseMessage(data);
  }

  private _parseMessage(data: Buffer): void {
    while (data.length > 6) {
      const paketType = data.readUInt16BE(0);
      const length = data.readUInt32BE(2);
      if (data.length < length + 6) {
        break;
      }
      const buf = data.subarray(6, length + 6);
      data = data.subarray(buf.length + 6);
      this._processProtoData(paketType, buf);
    }
  }

  private _processProtoData(typeEnc: number, buffer: Buffer): void {
    this._ensureReady();
    const type = this.protoBuf!.lookupType(`MumbleProto.${toType(typeEnc)}`);
    if (type.name === "UDPTunnel") {
      this.emit("UDPTunnel", buffer);
      return;
    }

    const message = type.decode(buffer);

    if (message === undefined) {
      console.error(`Received unknown message: ${buffer}`);
      return;
    }

    this.options.debug &&
      console.debug(
        `Received message of type: ${message.$type.name}: ${JSON.stringify(
          message
        )}`
      );
    this.emit(
      message.$type.name as TCPMessageTypeStrings,
      message.toJSON() as TCPMessage
    );
  }


  private _setupProtobuf(): void {
    if (!this.options.protobufPath) {
      throw Error("Protobuf path not set");
    }

    new Promise((resolve: (r: protobuf.Root) => void, reject) => {
      protobuf.load(this.options.protobufPath!, function (err, root) {
        if (err) reject(err);
        if (root === undefined) reject(new Error("Mumble protobuf not loaded"));
        resolve(root!);
      });
    }).then((root) => {
      this.protoBuf = root;
    });
  }

  private _sendTCPMessage(type: TCPMessageTypeStrings, message: TCPMessage) {
    this._ensureReady();
    const [head, pack] = this._createPackage(type, message);
    this.options.debug &&
      console.debug(
        `Sending message of type: ${type}: ${JSON.stringify(message)}`
      );

    this.tcpSocket!.write(head);
    this.tcpSocket!.write(pack);
  }

  private _authenticate() {
    this._ensureReady();
    this.sendProtocolMessage("Version", {
      version: 65536,
      release: "Blanky's Client",
      os: "NodeJS",
      osVersion: process.version,
    });
    this.sendProtocolMessage("Authenticate", {
      username: this.options.username,
      password: this.options.password ?? "",
      opus: true,
      tokensList: [],
      celtVersionsList: [],
    });
    this._enablePing();
  }

  private _ensureReady() {
    if (!this.tcpSocket || !this.protoBuf) {
      throw new Error("Not Ready to send/receive messages!");
    }
  }

  private _createPackage(
    type: TCPMessageTypeStrings,
    data: TCPMessage
  ): [Buffer, Uint8Array] {
    this._ensureReady();
    const protobufType = this.protoBuf!.lookupType(`MumbleProto.${type}`);
    if (protobufType.verify(data))
      console.error(`Error verifying payload for packet ${type}`);
    const pack = protobufType.encode(data).finish();
    const header = this._createMessageHeader(type, pack.length);

    return [header, pack];
  }

  private _createMessageHeader(type: TCPMessageTypeStrings, length: number) {
    const typeNum = toTypeNumber(type);
    const header = Buffer.alloc(6);
    header.writeUInt16BE(typeNum, 0);
    header.writeUInt32BE(length, 2);
    return header;
  }

  public getQueues(): Queues {
    return this.queues;
  }

  public writeAudio(
    packet: Buffer,
    whisperTarget: number,
    codec: 4 | 0,
    voiceSequence: number,
    final: boolean
  ) {
    this._ensureReady();
    packet = this.opus.encode(packet);

    const type = codec;
    const target = whisperTarget || 0;
    const typeTarget = (type << 5) | target;

    if (typeof voiceSequence !== "number") voiceSequence = this.voiceOutputSequence;

    const sequenceVarint = toVarint(voiceSequence);

    const voiceHeader = Buffer.alloc(1 + sequenceVarint.length);
    voiceHeader[0] = typeTarget;
    sequenceVarint.value.copy(voiceHeader, 1, 0);
    let header;

    if (codec == 4) {
      if (packet.length > 0x1fff)
        throw new TypeError(
          `Audio frame too long! Max Opus length is ${0x1fff} bytes.`
        );

      let headerValue = packet.length;

      if (final) headerValue += 1 << 7;

      const headerVarint = toVarint(headerValue);
      header = headerVarint.value;
    } else {
      throw new TypeError("Celt is not supported");
    }

    const frame = Buffer.alloc(header.length + packet.length);
    header.copy(frame, 0);

    packet.copy(frame, header.length);

    voiceSequence++;

    const tunnelHead = this._createMessageHeader(
      "UDPTunnel",
      voiceHeader.length + frame.length
    );
    this.tcpSocket!.write(tunnelHead);

    this.tcpSocket!.write(voiceHeader);
    this.tcpSocket!.write(frame);

    if (voiceSequence > this.voiceOutputSequence) this.voiceOutputSequence = voiceSequence;
    return 1;
  }


  joinChannel(channelId: number): 'ok' | 'alreadyInChannel' | 'channelNotFound' {
    const myState = this.users.get(this.users.getSelfId()!)!;
    if (myState?.channelId === channelId) return 'alreadyInChannel'
    if (!this.channels.get(channelId)) return 'channelNotFound'
    this.sendProtocolMessage("UserState", {
      ...myState,
      channelId: channelId,
      name: undefined,
    });
    return 'ok'
  }

  mute(): 'ok' | 'alreadyMuted' {
    const myState = this.users.get(this.users.getSelfId()!)!;
    if (myState?.mute) return 'alreadyMuted'
    this.sendProtocolMessage("UserState", {
      ...myState,
      mute: true,
      name: undefined,
    });
    return 'ok'
  }

  unmute(): 'ok' | 'alreadyUnmuted' {
    const myState = this.users.get(this.users.getSelfId()!)!;
    if (!myState?.mute) return 'alreadyUnmuted'
    this.sendProtocolMessage("UserState", {
      ...myState,
      mute: false,
      name: undefined,
    });
    return 'ok'
  }

  deafen(): 'ok' | 'alreadyDeafened' {
    const myState = this.users.get(this.users.getSelfId()!)!;
    if (myState?.deaf) return 'alreadyDeafened'
    this.sendProtocolMessage("UserState", {
      ...myState,
      deaf: true,
      name: undefined,
    });
    return 'ok'
  }

  undeafen(): 'ok' | 'alreadyUndeafened' {
    const myState = this.users.get(this.users.getSelfId()!)!;
    if (!myState?.deaf) return 'alreadyUndeafened'
    this.sendProtocolMessage("UserState", {
      ...myState,
      deaf: false,
      name: undefined,
    });
    return 'ok'
  }

  generateTools(): Tool[] {
    return [
      new DynamicTool({
        name: "joinChannel",
        description: "useful for when a user asks you to join a channel. Keep in mind: a user's sessionId IS NOT the same as a channelId! Usage: joinChannel <channelId>",
        func: async (arg: string) => this.joinChannel(parseInt(arg)),
      }),
      new DynamicTool({
        name: "mute",
        description: "mutes you",
        func: async (arg: string) => this.mute(),
      }),
      new DynamicTool({
        name: "unmute",
        description: "unmutes you",
        func: async (arg: string) => this.unmute(),
      }),
      new DynamicTool({
        name: "deafen",
        description: "deafens you",
        func: async (arg: string) => this.deafen(),
      }),
      new DynamicTool({
        name: "undeafen",
        description: "undeafens you",
        func: async (arg: string) => this.undeafen(),
      }),
      new DynamicTool({
        name: "sendChannelMessage",
        description: "useful for when a user asks you to send a message to a channel. Use channelLookup if you do not know the channelId. Usage: sendChannelMessage target:<channelId> <message>",
        func: async (arg: string) => {
          if (!arg.length) {
            return "Please provide a message to send!"
          }

          const target = arg.indexOf('target:') === 0 ? arg.split(' ')[0].split(':')[1] : undefined;

          if (!target) {
            return "Please provide a target to send the message to in the correct format!";
          }

          this.queues.textSendQueue.enqueue({ message: arg.replace(`target:${target} `, ''), channelId: [parseInt(target)] });
          return `Message successfully sent to channel ${target}.`;
        }
      }),

      new DynamicTool({
        name: "channelList",
        description: "useful for when you need a list of all channels. No input required.",
        func: async (arg: string) => {
          return `Channels: ${this.channels.getAll().map((channel) => channel.name).join(', ')}`;
        }
      }),
      new DynamicTool({
        name: "channelLookup",
        description: "useful for when you need the channelId for a specific channel name. Usage: channelLookup <channelName>",
        func: async (arg: string) => {
          if (!arg.length) {
            return "Please provide a channel name to lookup!"
          }
          const channelInfo = this.channels.findByName(arg);

          if (!channelInfo) {
            return `No channel found with name ${arg}. Maybe you misspelled it?`;
          }

          return `${channelInfo.name} has channelId ${channelInfo.channelId}`;
        }
      }),

      new DynamicTool({
        name: "userLookup",
        description: "useful for when you need more information about a specific user, like at what channel they currently are and more. Usage: userLookup <userIdOrName>",
        func: async (arg: string) => {
          if (!arg.length) {
            return "Please provide a user id or name to lookup!"
          }

          let userInfo = this.users.findByName(arg);
          if(!userInfo) {
            userInfo = this.users.get(parseInt(arg));
          }

          if (!userInfo) {
            return `No user found that matches this input!`;
          }

          return `User ${userInfo.name} has sessionId ${userInfo.session ?? 'unknown'}. Currently at channelId ${userInfo.channelId}, channelName ${this.channels.get(userInfo.channelId!)?.name ?? 'unknown'} and is ${userInfo.mute ? 'muted' : 'not muted'} and ${userInfo.deaf ? 'deafened' : 'not deafened'}.`;
        }
      }),

      new DynamicTool({
        name: "sendPrivateChatMessageTool",
        description: "useful for when a user asks you to send a message directly privately. Usage: sendChatMessage target:<userSession> <message>",
        func: async (arg: string) => {
          if (!arg.length) {
            return "Please provide a message to send!"
          }

          const target = arg.indexOf('target:') === 0 ? arg.split(' ')[0].split(':')[1] : undefined;

          if (!target) {
            return "Please provide a target to send the message to in the correct format!";
          }

          this.queues.textSendQueue.enqueue({ message: arg.replace(`target:${target} `, ''), session: [parseInt(target)] });
          return `Private message successfully sent.`;
        }
      }),
    ];
  }

}
