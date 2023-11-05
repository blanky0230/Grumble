// package: MumbleUDP
// file: src/proto/MumbleUDP.proto

import * as jspb from "google-protobuf";

export class Audio extends jspb.Message {
  hasTarget(): boolean;
  clearTarget(): void;
  getTarget(): number;
  setTarget(value: number): void;

  hasContext(): boolean;
  clearContext(): void;
  getContext(): number;
  setContext(value: number): void;

  getSenderSession(): number;
  setSenderSession(value: number): void;

  getFrameNumber(): number;
  setFrameNumber(value: number): void;

  getOpusData(): Uint8Array | string;
  getOpusData_asU8(): Uint8Array;
  getOpusData_asB64(): string;
  setOpusData(value: Uint8Array | string): void;

  clearPositionalDataList(): void;
  getPositionalDataList(): Array<number>;
  setPositionalDataList(value: Array<number>): void;
  addPositionalData(value: number, index?: number): number;

  getVolumeAdjustment(): number;
  setVolumeAdjustment(value: number): void;

  getIsTerminator(): boolean;
  setIsTerminator(value: boolean): void;

  getHeaderCase(): Audio.HeaderCase;
  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): Audio.AsObject;
  static toObject(includeInstance: boolean, msg: Audio): Audio.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: Audio, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): Audio;
  static deserializeBinaryFromReader(message: Audio, reader: jspb.BinaryReader): Audio;
}

export namespace Audio {
  export type AsObject = {
    target: number,
    context: number,
    senderSession: number,
    frameNumber: number,
    opusData: Buffer,
    positionalDataList: Array<number>,
    volumeAdjustment: number,
    isTerminator: boolean,
  }

  export enum HeaderCase {
    HEADER_NOT_SET = 0,
    TARGET = 1,
    CONTEXT = 2,
  }
}

export class Ping extends jspb.Message {
  getTimestamp(): number;
  setTimestamp(value: number): void;

  getRequestExtendedInformation(): boolean;
  setRequestExtendedInformation(value: boolean): void;

  getServerVersionV2(): number;
  setServerVersionV2(value: number): void;

  getUserCount(): number;
  setUserCount(value: number): void;

  getMaxUserCount(): number;
  setMaxUserCount(value: number): void;

  getMaxBandwidthPerUser(): number;
  setMaxBandwidthPerUser(value: number): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): Ping.AsObject;
  static toObject(includeInstance: boolean, msg: Ping): Ping.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: Ping, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): Ping;
  static deserializeBinaryFromReader(message: Ping, reader: jspb.BinaryReader): Ping;
}

export namespace Ping {
  export type AsObject = {
    timestamp: number,
    requestExtendedInformation: boolean,
    serverVersionV2: number,
    userCount: number,
    maxUserCount: number,
    maxBandwidthPerUser: number,
  }
}

