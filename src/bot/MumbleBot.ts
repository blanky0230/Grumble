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

    this.audioReceiver =  new AudioReceiver(this);
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

  //TODO: Move these to AITools
  public gotoChannel(id: number): boolean {
    const myState = this.users.get(this.users.getSelfId()!);
    if (myState?.channelId === id) return true;
    if (!myState) return false;
    this.sendProtocolMessage("UserState", {
      ...myState,
      channelId: id,
      name: undefined,
    });
    return true;
  }

  public gotoUser(name: string): boolean {
    this._ensureReady();
    const user = this.users.findByName(name);
    if (!user) {
      return false;
    }
    return this.gotoChannel(user.channelId!);
  }
}
