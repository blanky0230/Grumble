import {
  ACL,
  Authenticate,
  BanList,
  ChannelRemove,
  ChannelState,
  CodecVersion,
  ContextAction,
  ContextActionModify,
  CryptSetup,
  PermissionDenied,
  PermissionQuery,
  Ping,
  QueryUsers,
  Reject,
  RequestBlob,
  ServerConfig,
  ServerSync,
  SuggestConfig,
  TextMessage,
  UDPTunnel,
  UserList,
  UserRemove,
  UserState,
  UserStats,
  Version,
  VoiceTarget,
} from "../generated/src/proto/Mumble_pb";

export const allMessageTypes = [
  "Version",
  "UDPTunnel",
  "Authenticate",
  "Ping",
  "Reject",
  "ServerSync",
  "ChannelRemove",
  "ChannelState",
  "UserRemove",
  "UserState",
  "BanList",
  "TextMessage",
  "PermissionDenied",
  "ACL",
  "QueryUsers",
  "CryptSetup",
  "ContextActionModify",
  "ContextAction",
  "UserList",
  "VoiceTarget",
  "PermissionQuery",
  "CodecVersion",
  "UserStats",
  "RequestBlob",
  "ServerConfig",
  "SuggestConfig",
] as const;

export type TCPMessageTypeStrings = typeof allMessageTypes[number];

export type CustomUDPTunnel = {
  audioType: number,
  whisperTarget: number,
  sender: number,
  sequence: number,
  lastFrame: boolean,
  opusData: Uint8Array,
  decodedData: Uint8Array
}

export type TCPMessage =
  ACL.AsObject|
  Authenticate.AsObject|
  BanList.AsObject|
  ChannelRemove.AsObject|
  ChannelState.AsObject|
  CodecVersion.AsObject|
  ContextAction.AsObject|
  ContextActionModify.AsObject|
  CryptSetup.AsObject|
  PermissionDenied.AsObject|
  PermissionQuery.AsObject|
  Ping.AsObject|
  QueryUsers.AsObject|
  Reject.AsObject|
  RequestBlob.AsObject|
  ServerConfig.AsObject|
  ServerSync.AsObject|
  SuggestConfig.AsObject|
  TextMessage.AsObject|
  UDPTunnel.AsObject|
  UserList.AsObject|
  UserRemove.AsObject|
  UserState.AsObject|
  UserStats.AsObject|
  Version.AsObject|
  VoiceTarget.AsObject

export function toTypeNumber(type: TCPMessageTypeStrings): number {
  return Messages[type];
}

export function toType(type: number): TCPMessageTypeStrings {
  for (const [key, value] of Object.entries(Messages)) {
    if (value === type) {
      return key as TCPMessageTypeStrings;
    }
  }

  throw Error(`Unknown type ${type}`);
}

export const Messages: Record<TCPMessageTypeStrings, number> = {
  Version: 0,
  UDPTunnel: 1,
  Authenticate: 2,
  Ping: 3,
  Reject: 4,
  ServerSync: 5,
  ChannelRemove: 6,
  ChannelState: 7,
  UserRemove: 8,
  UserState: 9,
  BanList: 10,
  TextMessage: 11,
  PermissionDenied: 12,
  ACL: 13,
  QueryUsers: 14,
  CryptSetup: 15,
  ContextActionModify: 16,
  ContextAction: 17,
  UserList: 18,
  VoiceTarget: 19,
  PermissionQuery: 20,
  CodecVersion: 21,
  UserStats: 22,
  RequestBlob: 23,
  ServerConfig: 24,
  SuggestConfig: 25,
};

export type MessageStringToType = {
  Version: Version.AsObject,
  UDPTunnel: any,
  Authenticate: Authenticate.AsObject,
  Ping: Ping.AsObject,
  Reject: Reject.AsObject,
  ServerSync: ServerSync.AsObject,
  ChannelRemove: ChannelRemove.AsObject,
  ChannelState: ChannelState.AsObject,
  UserRemove: UserRemove.AsObject,
  UserState: UserState.AsObject,
  BanList: BanList.AsObject,
  TextMessage: TextMessage.AsObject,
  PermissionDenied: PermissionDenied.AsObject,
  ACL: ACL.AsObject,
  QueryUsers: QueryUsers.AsObject,
  CryptSetup: CryptSetup.AsObject,
  ContextActionModify: ContextActionModify.AsObject,
  ContextAction: ContextAction.AsObject,
  UserList: UserList.AsObject,
  VoiceTarget: VoiceTarget.AsObject,
  PermissionQuery: PermissionQuery.AsObject,
  CodecVersion: CodecVersion.AsObject,
  UserStats: UserStats.AsObject,
  RequestBlob: RequestBlob.AsObject,
  ServerConfig: ServerConfig.AsObject,
  SuggestConfig: SuggestConfig.AsObject,
};

export function encodeVersion(major: number, minor: number, patch: number): number 
{
  return  ((major & 0xffff) << 16) |
  ((minor & 0xff) << 8) |
  (patch & 0xff)
}

export function encodeVersionV2(major: number, minor: number, patch: number): number 
{
  return  ((major & 0xffff) << 16) |
  ((minor & 0xff) << 8) |
  (patch & 0xff)
}

export function decodeVersion(encodedVersion: number): string
{
  const major = (encodedVersion >> 16) & 0xffff;
  const minor = (encodedVersion >> 8) & 0xff;
  const patch = encodedVersion & 0xff;
  return `${major}.${minor}.${patch}`;
}

export function toVarint(i: number): { value: Buffer, length: number } {

  var arr = [];
  if( i < 0 ) {
      i = ~i;
      if( i <= 0x3 ) { return {value: Buffer.from([ 0xFC | i ]), length: 1 }; }

      arr.push( 0xF8 );
  }

  if( i < 0x80 ) {
      arr.push( i );
  } else if ( i < 0x4000 ) {
      arr.push(( i >> 8 ) | 0x80 );
      arr.push(i & 0xFF );
  } else if ( i < 0x200000 ) {
      arr.push((i >> 16) | 0xC0);
      arr.push((i >> 8) & 0xFF);
      arr.push(i & 0xFF);
  } else if ( i < 0x10000000 ) {
      arr.push((i >> 24) | 0xE0);
      arr.push((i >> 16) & 0xFF);
      arr.push((i >> 8) & 0xFF);
      arr.push(i & 0xFF);
  } else if ( i < 0x100000000 ) {
      arr.push(0xF0);
      arr.push((i >> 24) & 0xFF);
      arr.push((i >> 16) & 0xFF);
      arr.push((i >> 8) & 0xFF);
      arr.push(i & 0xFF);
  } else {
      throw new TypeError( "Non-integer values are not supported. (" + i + ")" );
  }

  return {
      value: Buffer.from( arr ),
      length: arr.length
  };
}

export function fromVarInt(buf: Buffer): { value: number, consumed: number } {
  // TODO: 111110__ + varint	Negative recursive varint
  // TODO: 111111xx       	Byte-inverted negative two bit number (~xx)

  var retVal = {
      value: 0,
      consumed: 0
  }

  if (buf[0] < 0x80) {
      // 0xxxxxxx            7 bit positive number
      retVal.value = buf[0];
      retVal.consumed = 1;
  } else if (buf[0] < 0xC0) {
      // 10xxxxxx + 1 byte   14-bit positive number
      retVal.value = (buf[0] & 0x3F) << 8;
      retVal.value |= buf[1];
      retVal.consumed = 2;
  } else if (buf[0] < 0xE0) {
      // 110xxxxx + 2 bytes  21-bit positive number
      retVal.value = (buf[0] & 0x1F) << 16;
      retVal.value |= (buf[1]) << 8;
      retVal.value |= (buf[2]);
      retVal.consumed = 3;
  } else if (buf[0] < 0xF0) {
      // 1110xxxx + 3 bytes  28-bit positive number
      retVal.value = (buf[0] & 0x0F) << 24;
      retVal.value |= (buf[1]) << 16;
      retVal.value |= (buf[2]) << 8;
      retVal.value |= (buf[3]);
      retVal.consumed = 4;
  } else if (buf[0] < 0xF4) {
      // 111100__ + int (32-bit)
      retVal.value = (buf[1]) << 24;
      retVal.value |= (buf[2]) << 16;
      retVal.value |= (buf[3]) << 8;
      retVal.value |= (buf[4]);
      retVal.consumed = 5;
  } else if (buf[0] < 0xFC) {
      // 111101__ + long (64-bit)
      retVal.value = (buf[1]) << 56;
      retVal.value |= (buf[2]) << 48;
      retVal.value |= (buf[3]) << 40;
      retVal.value |= (buf[4]) << 32;
      retVal.value |= (buf[5]) << 24;
      retVal.value |= (buf[6]) << 16;
      retVal.value |= (buf[7]) << 8;
      retVal.value |= (buf[8]);
      retVal.consumed = 9;
  }

  return retVal;
}