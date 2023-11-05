import path from "path";
import { MumbleBot } from "./MumbleBot";
import protobuf from "protobufjs";
import { Audio } from "../generated/src/proto/MumbleUDP_pb";
import { fromVarInt } from "../proto/ProtoExtras";
import { TypedEventEmitter } from "../lib/TypedEventEmitter";

export class AudioReceiver extends TypedEventEmitter<Record<"Audio", Audio.AsObject>> {
  private mumbleBot: MumbleBot;
  private protobufPath?: string;
  private protoBuf?: protobuf.Root;

  constructor(mumbleBot: MumbleBot) {
    super();
    this.mumbleBot = mumbleBot;

    if (!mumbleBot.options.protobufPath) {
      this.protobufPath = path.join(__dirname, "..", "proto", "Mumble.proto");
    } else {
      this.protobufPath = mumbleBot.options.protobufPath.replace(
        "Mumble.proto",
        "MumbleUDP.proto"
      );
    }

    this._setupProtobuf();
  }

  private _setupProtobuf() {
    new Promise((resolve: (r: protobuf.Root) => void, reject) => {
      protobuf.load(this.protobufPath!, function (err, root) {
        if (err) reject(err);
        if (root === undefined) reject(new Error("Mumble protobuf not loaded"));
        resolve(root!);
      });
    }).then((root) => {
      this.protoBuf = root;
      this._setupProtobufListeners();
    });
  }

  private _setupProtobufListeners() {
    this.mumbleBot.on("UDPTunnel", (message) => {
      const audioTypeProto = this.protoBuf!.lookupType("MumbleUDP.Audio");
      const pingTypeProto = this.protoBuf!.lookupType("MumbleUDP.Ping");
      const audioType = (message[0] & 0xe0) >> 5;
      if (audioType === 1) {
        return;
      }
      if (audioType !== 4) {
        throw Error(`Unsupported audio type ${audioType}`);
      }

      const audio = this._readAudioRaw(message as Buffer);
      if(audio !== undefined) {
        this._handleAudio(audio);
      }
    });
  }

  private _handleAudio(audio: Audio.AsObject) {
    this.emit("Audio", audio);
  }

  private _readAudioRaw(data: Buffer): Audio.AsObject | undefined {
    const audioType = (data[0] & 0xE0) >> 5;
    const audioTarget = data[0] & 0x1F;

    // Offset in data from where we are currently reading
    var offset = 1;

    var varInt = fromVarInt(data.subarray(offset, offset + 9));
    const sender = varInt.value;
    offset += varInt.consumed;

    varInt = fromVarInt(data.subarray(offset, offset + 9));
    const sequence = varInt.value;
    offset += varInt.consumed;

    if (audioType != 4) {
            console.warn('Unspported audio codec in voice stream from user ' + sender + ': ', audioType);
        return;
    }

    // Opus header
    varInt = fromVarInt(data.subarray(offset, offset + 9));
    offset += varInt.consumed;
    const opusHeader = varInt.value;

    const opusLength = opusHeader & 0x1FFF;
    const lastFrame = (opusHeader & 0x2000) ? true : false;

    const opusData = data.subarray(offset, offset + opusLength);

    return {
        target: audioTarget,
        context: 0,
        positionalDataList: [],
        volumeAdjustment: 0,
        senderSession: sender,
        frameNumber: sequence,
        isTerminator: lastFrame,
        opusData: opusData,
    }
  }
}
