# Grumble

A lot of protocol-specific code is copied from: https://github.com/Gielert/NoodleJS
Starting this project, I first tried to just use NoodleJS, but I wanted to make some changes to the architecture, as well as use TypeScript.

## The Mumble Client

The "core" of this project is basically a Mumble client. It can connect to a Mumble server, and send and receive messages. It can also send and receive voice data.
Using this client, we can build a bot to do whatever we want.

So what I basically wanted to try, is create an AI Agent using Langchain and OpenAI.

### The "core" idea

The "MumbleBot" class emits events when it receives a message, or when it receives voice data. So we can listen to these events, and do whatever we want with them.
To add a layer on top, I added Queues for text input and output, and for voice input and output, as well as additionally a queue for voice generation, sort of as an intermediate between audio input and output.

This allows to create a bot that can talk to people on a Mumble server, and respond to them.

## The AI Agent

For now I just made an example of how to use the Mumble client, and how to use the Langchain API. Pretty much with the main goal to just learn how to use Lanchain myself.
So take everything here with a grain of salt.