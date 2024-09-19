#!/usr/bin/env node

import * as net from "node:net";

const PROTOCOL_VERSION = "2.3";

type PortStatus = "U" | "L" | "O" | "F";

// Define initial labels
const inputLabels: Label = {};
const outputLabels: Label = {};
const videoOutputRouting: Routing = {};
const videoOutputLocks: Locks = {};
let inputCount = process.env.IO ? Number.parseInt(process.env.IO) : 128;
let outputCount = process.env.IO ? Number.parseInt(process.env.IO) : 128;
interface Label {
	[key: number]: string;
}

interface Routing {
	[output: number]: number;
}

interface Locks {
	[output: number]: PortStatus;
}

interface ClientState {
	address: string;
}

const server = net.createServer();

// Keep track of all connected clients
const clients: net.Socket[] = [];

server.on("connection", (socket) => {
	const clientAddress = `${socket.remoteAddress}:${socket.remotePort}`;
	console.log(`Client connected: ${clientAddress}`);

	clients.push(socket);

	// Initialize client state if necessary
	const clientState: ClientState = {
		address: clientAddress,
	};

	// Send initial data
	sendProtocolPreamble(socket);
	sendDeviceInformation(socket);
	sendInitialStatusDump(socket);

	// Handle incoming data
	socket.on("data", (data) => {
		handleIncomingData(socket, data, clientState);
	});

	socket.on("end", () => {
		console.log(`Client disconnected: ${clientAddress}`);
		// Remove from clients array
		const index = clients.indexOf(socket);
		if (index !== -1) {
			clients.splice(index, 1);
		}
	});

	socket.on("error", (err) => {
		console.error(`Socket error from ${clientAddress}: ${err.message}`);
	});
});

function sendProtocolPreamble(socket: net.Socket) {
	const preamble = `PROTOCOL PREAMBLE:\r\nVersion: ${PROTOCOL_VERSION} \r\n\r\n`;
	socket.write(preamble);
}

function sendDeviceInformation(socket: net.Socket) {
	const deviceInfo = `VIDEOHUB DEVICE:\r\nDevice present: true\r\nModel name: Blackmagic Smart Videohub\r\nVideo inputs: ${inputCount}\r\nVideo processing units: 0\r\nVideo outputs: ${outputCount}\r\nVideo monitoring outputs: 0\r\nSerial ports: 0\r\n\r\n`;
	socket.write(deviceInfo);
}

function sendInitialStatusDump(socket: net.Socket) {
	sendLabels(socket, "INPUT LABELS", inputLabels);
	sendLabels(socket, "OUTPUT LABELS", outputLabels);
	sendRouting(socket, "VIDEO OUTPUT ROUTING", videoOutputRouting);
	sendLocks(socket, "VIDEO OUTPUT LOCKS", videoOutputLocks);
}

function sendLabels(socket: net.Socket, header: string, labels: Label) {
	let message = `${header}:\r\n`;
	for (const key in labels) {
		message += `${key} ${labels[key]}\r\n`;
	}
	message += "\r\n";
	socket.write(message);
}

function sendRouting(socket: net.Socket, header: string, routing: Routing) {
	let message = `${header}:\r\n`;
	for (const key in routing) {
		message += `${key} ${routing[key]}\r\n`;
	}
	message += "\r\n";
	socket.write(message);
}

function sendLocks(socket: net.Socket, header: string, locks: Locks) {
	let message = `${header}:\r\n`;
	for (const key in locks) {
		message += `${key} ${locks[key]}\r\n`;
	}
	message += "\r\n";
	socket.write(message);
}

function handleIncomingData(
	socket: net.Socket,
	data: Buffer,
	clientState: ClientState,
) {
	const message = data.toString();
	const lines = message.split(/\r?\n/);
	let currentHeader = "";
	let blockLines: string[] = [];

	for (const line of lines) {
		if (line.endsWith(":")) {
			// New header
			currentHeader = line.trim();
			blockLines = [];
		} else if (line.trim() === "") {
			// End of block
			if (currentHeader) {
				parseClientCommand(socket, currentHeader, blockLines, clientState);
				currentHeader = "";
				blockLines = [];
			}
		} else {
			// Add line to current block
			blockLines.push(line);
		}
	}
}

function parseClientCommand(
	socket: net.Socket,
	header: string,
	lines: string[],
	clientState: ClientState,
) {
	switch (header) {
		case "PING:":
			handlePing(socket);
			break;
		case "VIDEO OUTPUT ROUTING:":
			handleVideoOutputRoutingCommand(socket, lines);
			break;
		case "OUTPUT LABELS:":
			handleOutputLabelsCommand(socket, lines);
			break;
		case "VIDEO OUTPUT LOCKS:":
			handleVideoOutputLocksCommand(socket, lines, clientState);
			break;
		case "INPUT LABELS:":
			handleInputLabelsCommand(socket, lines);
			break;
		default:
			// Unrecognized command
			sendNAK(socket);
			break;
	}
}

function sendACK(socket: net.Socket) {
	socket.write("ACK\r\n\r\n");
}

function sendNAK(socket: net.Socket) {
	socket.write("NAK\r\n\r\n");
}

function handlePing(socket: net.Socket) {
	sendACK(socket);
}

function handleVideoOutputRoutingCommand(socket: net.Socket, lines: string[]) {
	let updated = false;
	for (const line of lines) {
		const [outputStr, inputStr] = line.split(" ");
		const output = Number.parseInt(outputStr);
		const input = Number.parseInt(inputStr);
		if (!Number.isNaN(output) && !Number.isNaN(input)) {
			videoOutputRouting[output] = input;
			updated = true;
		}
	}
	if (updated) {
		sendACK(socket);
		broadcastRoutingUpdate("VIDEO OUTPUT ROUTING", videoOutputRouting);
	} else {
		sendNAK(socket);
	}
}

function broadcastRoutingUpdate(header: string, routing: Routing) {
	const message = buildRoutingMessage(header, routing);
	broadcastMessage(message);
}

function buildRoutingMessage(header: string, routing: Routing) {
	let message = `${header}:\r\n`;
	for (const key in routing) {
		message += `${key} ${routing[key]}\r\n`;
	}
	message += "\r\n";
	return message;
}

function broadcastMessage(message: string) {
	for (const conn of clients) {
		conn.write(message);
	}
}

function handleOutputLabelsCommand(socket: net.Socket, lines: string[]) {
	let updated = false;
	for (const line of lines) {
		const index = line.indexOf(" ");
		if (index > -1) {
			const outputStr = line.substring(0, index);
			const label = line.substring(index + 1);
			const output = Number.parseInt(outputStr);
			if (!Number.isNaN(output)) {
				outputLabels[output] = label;
				updated = true;
			}
		}
	}
	if (updated) {
		sendACK(socket);
		broadcastLabelsUpdate("OUTPUT LABELS", outputLabels);
	} else {
		sendNAK(socket);
	}
}

function broadcastLabelsUpdate(header: string, labels: Label) {
	const message = buildLabelsMessage(header, labels);
	broadcastMessage(message);
}

function buildLabelsMessage(header: string, labels: Label) {
	let message = `${header}:\r\n`;
	for (const key in labels) {
		message += `${key} ${labels[key]}\r\n`;
	}
	message += "\r\n";
	return message;
}

function handleVideoOutputLocksCommand(
	socket: net.Socket,
	lines: string[],
	clientState: ClientState,
) {
	let updated = false;
	for (const line of lines) {
		const [outputStr, status] = line.split(" ");
		const output = Number.parseInt(outputStr);
		if (!Number.isNaN(output) && ["U", "L", "O", "F"].includes(status)) {
			if (status === "O") {
				// Lock the port
				videoOutputLocks[output] = "O";
				updated = true;
			} else if (status === "U") {
				// Unlock the port
				videoOutputLocks[output] = "U";
				updated = true;
			} else if (status === "F") {
				// Force unlock
				videoOutputLocks[output] = "U";
				updated = true;
			}
			// Note: In a real implementation, you'd check ownership and handle 'L' status
		}
	}
	if (updated) {
		sendACK(socket);
		broadcastLocksUpdate("VIDEO OUTPUT LOCKS", videoOutputLocks);
	} else {
		sendNAK(socket);
	}
}

function broadcastLocksUpdate(header: string, locks: Locks) {
	const message = buildLocksMessage(header, locks);
	broadcastMessage(message);
}

function buildLocksMessage(header: string, locks: Locks) {
	let message = `${header}:\r\n`;
	for (const key in locks) {
		message += `${key} ${locks[key]}\r\n`;
	}
	message += "\r\n";
	return message;
}

function handleInputLabelsCommand(socket: net.Socket, lines: string[]) {
	let updated = false;
	for (const line of lines) {
		const index = line.indexOf(" ");
		if (index > -1) {
			const inputStr = line.substring(0, index);
			const label = line.substring(index + 1);
			const input = Number.parseInt(inputStr);
			if (!Number.isNaN(input)) {
				inputLabels[input] = label;
				updated = true;
			}
		}
	}
	if (updated) {
		sendACK(socket);
		broadcastLabelsUpdate("INPUT LABELS", inputLabels);
	} else {
		sendNAK(socket);
	}
}

export function startServer(port = 9990): net.Server {
	server.listen(port, () => {
		console.log(`Successfully bound ${port}`);
	});

	return server;
}

export function init(ioCount: number) {
	inputCount = ioCount;
	outputCount = ioCount;

	for (let i = 0; i < inputCount; i++) {
		inputLabels[i] = `Input ${i + 1}`;
	}

	for (let i = 0; i < outputCount; i++) {
		outputLabels[i] = `Output ${i + 1}`;
	}

	// Define initial routing (map outputs to inputs)

	for (let i = 0; i < outputCount; i++) {
		videoOutputRouting[i] = i; // Initially, route input N to output N
	}

	// Define initial locks (all unlocked)

	for (let i = 0; i < outputCount; i++) {
		videoOutputLocks[i] = "U";
	}
}

if (require.main === module) {
	// port and iocount announce
	console.log(`Starting server with ${process.env.IO || 128} IOs`);
	startServer(Number.parseInt(process.env.PORT as string) || 9990);
}
