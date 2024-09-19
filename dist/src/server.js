#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startServer = startServer;
exports.init = init;
const net = __importStar(require("node:net"));
const PROTOCOL_VERSION = "2.3";
// Define initial labels
const inputLabels = {};
const outputLabels = {};
const videoOutputRouting = {};
const videoOutputLocks = {};
let inputCount = process.env.IO ? Number.parseInt(process.env.IO) : 128;
let outputCount = process.env.IO ? Number.parseInt(process.env.IO) : 128;
const server = net.createServer();
// Keep track of all connected clients
const clients = [];
server.on("connection", (socket) => {
    const clientAddress = `${socket.remoteAddress}:${socket.remotePort}`;
    console.log(`Client connected: ${clientAddress}`);
    clients.push(socket);
    // Initialize client state if necessary
    const clientState = {
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
function sendProtocolPreamble(socket) {
    const preamble = `PROTOCOL PREAMBLE:\r\nVersion: ${PROTOCOL_VERSION} \r\n\r\n`;
    socket.write(preamble);
}
function sendDeviceInformation(socket) {
    const deviceInfo = `VIDEOHUB DEVICE:\r\nDevice present: true\r\nModel name: Blackmagic Smart Videohub\r\nVideo inputs: ${inputCount}\r\nVideo processing units: 0\r\nVideo outputs: ${outputCount}\r\nVideo monitoring outputs: 0\r\nSerial ports: 0\r\n\r\n`;
    socket.write(deviceInfo);
}
function sendInitialStatusDump(socket) {
    sendLabels(socket, "INPUT LABELS", inputLabels);
    sendLabels(socket, "OUTPUT LABELS", outputLabels);
    sendRouting(socket, "VIDEO OUTPUT ROUTING", videoOutputRouting);
    sendLocks(socket, "VIDEO OUTPUT LOCKS", videoOutputLocks);
}
function sendLabels(socket, header, labels) {
    let message = `${header}:\r\n`;
    for (const key in labels) {
        message += `${key} ${labels[key]}\r\n`;
    }
    message += "\r\n";
    socket.write(message);
}
function sendRouting(socket, header, routing) {
    let message = `${header}:\r\n`;
    for (const key in routing) {
        message += `${key} ${routing[key]}\r\n`;
    }
    message += "\r\n";
    socket.write(message);
}
function sendLocks(socket, header, locks) {
    let message = `${header}:\r\n`;
    for (const key in locks) {
        message += `${key} ${locks[key]}\r\n`;
    }
    message += "\r\n";
    socket.write(message);
}
function handleIncomingData(socket, data, clientState) {
    const message = data.toString();
    const lines = message.split(/\r?\n/);
    let currentHeader = "";
    let blockLines = [];
    for (const line of lines) {
        if (line.endsWith(":")) {
            // New header
            currentHeader = line.trim();
            blockLines = [];
        }
        else if (line.trim() === "") {
            // End of block
            if (currentHeader) {
                parseClientCommand(socket, currentHeader, blockLines, clientState);
                currentHeader = "";
                blockLines = [];
            }
        }
        else {
            // Add line to current block
            blockLines.push(line);
        }
    }
}
function parseClientCommand(socket, header, lines, clientState) {
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
function sendACK(socket) {
    socket.write("ACK\r\n\r\n");
}
function sendNAK(socket) {
    socket.write("NAK\r\n\r\n");
}
function handlePing(socket) {
    sendACK(socket);
}
function handleVideoOutputRoutingCommand(socket, lines) {
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
    }
    else {
        sendNAK(socket);
    }
}
function broadcastRoutingUpdate(header, routing) {
    const message = buildRoutingMessage(header, routing);
    broadcastMessage(message);
}
function buildRoutingMessage(header, routing) {
    let message = `${header}:\r\n`;
    for (const key in routing) {
        message += `${key} ${routing[key]}\r\n`;
    }
    message += "\r\n";
    return message;
}
function broadcastMessage(message) {
    for (const conn of clients) {
        conn.write(message);
    }
}
function handleOutputLabelsCommand(socket, lines) {
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
    }
    else {
        sendNAK(socket);
    }
}
function broadcastLabelsUpdate(header, labels) {
    const message = buildLabelsMessage(header, labels);
    broadcastMessage(message);
}
function buildLabelsMessage(header, labels) {
    let message = `${header}:\r\n`;
    for (const key in labels) {
        message += `${key} ${labels[key]}\r\n`;
    }
    message += "\r\n";
    return message;
}
function handleVideoOutputLocksCommand(socket, lines, clientState) {
    let updated = false;
    for (const line of lines) {
        const [outputStr, status] = line.split(" ");
        const output = Number.parseInt(outputStr);
        if (!Number.isNaN(output) && ["U", "L", "O", "F"].includes(status)) {
            if (status === "O") {
                // Lock the port
                videoOutputLocks[output] = "O";
                updated = true;
            }
            else if (status === "U") {
                // Unlock the port
                videoOutputLocks[output] = "U";
                updated = true;
            }
            else if (status === "F") {
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
    }
    else {
        sendNAK(socket);
    }
}
function broadcastLocksUpdate(header, locks) {
    const message = buildLocksMessage(header, locks);
    broadcastMessage(message);
}
function buildLocksMessage(header, locks) {
    let message = `${header}:\r\n`;
    for (const key in locks) {
        message += `${key} ${locks[key]}\r\n`;
    }
    message += "\r\n";
    return message;
}
function handleInputLabelsCommand(socket, lines) {
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
    }
    else {
        sendNAK(socket);
    }
}
function startServer(port = 9990) {
    server.listen(port, () => {
        console.log(`Successfully bound ${port}`);
    });
    return server;
}
function init(ioCount) {
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
    startServer(Number.parseInt(process.env.PORT) || 9990);
}
