import { Audio } from "../generated/src/proto/MumbleUDP_pb";
import { TextMessage } from "../generated/src/proto/Mumble_pb";
import { EventemittingQueue } from "../lib/EventEmittingQueue";

export type AudioInput = {
    file: string,
    context: Audio.AsObject["context"],
    senderSession: Audio.AsObject["senderSession"],
}

export type AudioOutput = {
    file: string,
    context: Audio.AsObject["context"],
    target: Audio.AsObject["target"],
}

export type AudioGeneration = {
    text: string,
    context: Audio.AsObject["context"],
    target: Audio.AsObject["target"],
}

export type TextInput = TextMessage.AsObject & { actor: number }
export type TextOutput = TextMessage.AsObject & {isError?: boolean};

export type Queues = {
  audioInputQueue: EventemittingQueue<AudioInput>;
  audioGenerationQueue: EventemittingQueue<AudioGeneration>;
  audioPlayQueue: EventemittingQueue<AudioOutput>;

  textSendQueue: EventemittingQueue<TextOutput>;
  textInputQueue: EventemittingQueue<TextInput>;
}