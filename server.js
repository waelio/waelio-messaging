// server.js

import { WebSocketServer } from 'ws';
import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

// Use the PORT environment variable provided by Render, with a fallback for local development
const PORT = process.env.PORT || 8080;

// --- HTTP Server Setup with Express ---
const app = express();
const server = http.createServer(app);

// Initialize the WebSocket server and attach it to the HTTP server
const wss = new WebSocketServer({ server });

/**
 * @type {Map<string, import('ws')>}
 * A map to store connected clients, keyed by their unique ID.
 * The value is the WebSocket connection object itself.
 */
const clients = new Map();

// Serve static files from the 'public' directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(__dirname));

// Start the HTTP server
server.listen(PORT, () => {
    console.log(`[Server] HTTP and WebSocket server started on port ${PORT}`);
});

// --- WebSocket Server Event Handlers ---

wss.on('connection', (ws, req) => {
    const clientIp = req.socket.remoteAddress;
    console.log(`[Server] New client connected from ${clientIp}`);

    // 1. Handle incoming messages from this client
    ws.on('message', (message) => {
        try {
            const parsedMessage = JSON.parse(message.toString());
            handleClientMessage(ws, parsedMessage);
        } catch (error) {
            console.error('[Server] Error parsing message or handling client message:', error);
            ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON format.' }));
        }
    });

    // 2. Handle client disconnection
    ws.on('close', () => {
        // ws.clientId is attached during registration
        const clientId = ws.clientId;
        if (clientId) {
            clients.delete(clientId);
            console.log(`[Server] Client '${clientId}' disconnected.`);
            // Notify all other clients that this user has disconnected
            broadcastClientList();
        }
    });

    // 3. Handle potential errors
    ws.on('error', (error) => {
        console.error('[Server] WebSocket error:', error);
    });
});

/**
 * Broadcasts the current list of connected client IDs to everyone.
 */
function broadcastClientList() {
    const clientList = Array.from(clients.keys());
    const message = {
        type: 'user-list',
        users: clientList
    };
    const messageString = JSON.stringify(message);

    for (const clientWs of clients.values()) {
        clientWs.send(messageString);
    }
}

/**
 * Processes and routes messages from a client.
 * @param {import('ws')} ws The WebSocket connection object for the sender.
 * @param {object} message The parsed JSON message from the client.
 */
function handleClientMessage(ws, message) {
    console.log('[Server] Received message:', message);

    switch (message.type) {
        case 'register':
            // Register the client with its unique ID
            const clientId = message.id;
            if (!clientId) {
                ws.send(JSON.stringify({ type: 'error', message: 'Registration failed: ID is required.' }));
                return;
            }
            ws.clientId = clientId; // Attach the ID directly to the WebSocket object
            clients.set(clientId, ws);
            console.log(`[Server] Client registered with ID: ${clientId}`);
            ws.send(JSON.stringify({ type: 'info', message: `Successfully registered as '${clientId}'.` }));
            // Announce the new user to everyone
            broadcastClientList();
            break;

        case 'route':
            // Route a message to a specific destination client
            const destinationId = message.to;
            const destinationWs = clients.get(destinationId);

            if (destinationWs) {
                // Add the sender's ID to the payload for context
                const senderId = ws.clientId; // Use the attached ID
                const outboundMessage = {
                    type: 'message',
                    from: senderId || 'unknown',
                    payload: message.payload
                };
                destinationWs.send(JSON.stringify(outboundMessage));
                console.log(`[Server] Routed message from '${senderId}' to '${destinationId}'.`);
            } else {
                console.warn(`[Server] Could not find destination client '${destinationId}'.`);
                ws.send(JSON.stringify({ type: 'error', message: `Client '${destinationId}' not found or not connected.` }));
            }
            break;

        case 'broadcast':
            // Broadcast a message to ALL connected clients
            const broadcastSenderId = ws.clientId; // Use the attached ID
            const broadcastMessage = {
                type: 'message',
                from: broadcastSenderId || 'unknown',
                payload: message.payload,
                isBroadcast: true // Flag to indicate a broadcast
            };
            const broadcastString = JSON.stringify(broadcastMessage);

            console.log(`[Server] Broadcasting message from '${broadcastSenderId}'.`);
            // Iterate over all connected clients and send the message
            for (const [id, clientWs] of clients.entries()) {
                // Don't send the broadcast message back to the sender
                if (id !== broadcastSenderId) {
                    clientWs.send(broadcastString);
                }
            }
            break;

        default:
            console.warn(`[Server] Unknown message type: ${message.type}`);
            ws.send(JSON.stringify({ type: 'error', message: `Unknown message type: '${message.type}'.` }));
    }
}
