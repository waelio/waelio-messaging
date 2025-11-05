// server.js

import 'dotenv/config';
import { WebSocketServer } from 'ws';
import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { MongoClient } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';

// Use the PORT environment variable provided by Render, with a fallback for local development
const PORT = process.env.PORT || 8080;
const DB_HISTORY_LIMIT = 100;
const IN_MEMORY_HISTORY_LIMIT = 10;

// --- MongoDB Setup ---
// Use a MongoDB connection string from environment variables.
const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = 'messagingApp';
// The client is only initialized if a URI is provided.
const mongoClient = MONGO_URI ? new MongoClient(MONGO_URI) : null;
let messagesCollection;

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

/**
 * Connects to MongoDB and starts the HTTP server.
 */
async function startServer() {
    if (mongoClient) {
        try {
            await mongoClient.connect();
            console.log('[Database] Connected successfully to MongoDB.');
            const db = mongoClient.db(DB_NAME);
            messagesCollection = db.collection('messages');
        } catch (err) {
            console.error('[Database] ERROR: Could not connect to MongoDB using the provided MONGO_URI.');
            console.error('[Database] Please check your connection string and network access rules.');
            console.error(err);
            process.exit(1); // Exit if DB was configured but failed to connect.
        }
    } else {
        console.warn('*********************************************************************');
        console.warn('[Server] WARNING: No MONGO_URI found in .env file.');
        console.warn('[Server] Running in IN-MEMORY mode. Messages will NOT be persisted.');
        console.warn('*********************************************************************');
        
        // Create a functional in-memory store with a limited size.
        const inMemoryMessages = [];
        messagesCollection = {
            insertOne: (message) => {
                inMemoryMessages.push(message);
                // If the array exceeds the limit, remove the oldest message.
                if (inMemoryMessages.length > IN_MEMORY_HISTORY_LIMIT) {
                    inMemoryMessages.shift();
                }
                return Promise.resolve();
            },
            find: (query) => {
                // The query is { $or: [ { recipientId }, { senderId }, { isBroadcast } ] }
                const orClauses = query.$or;
                const recipientId = orClauses[0].recipientId;
                const senderId = orClauses[1].senderId;
                const filtered = inMemoryMessages.filter(msg => msg.isBroadcast || msg.senderId === senderId || msg.recipientId === recipientId);
                return { toArray: () => Promise.resolve(filtered) };
            }
        };
    }

    // Start the server regardless of database connection status
    server.listen(PORT, () => {
        console.log(`[Server] HTTP and WebSocket server started on port ${PORT}`);
    });
}

// --- WebSocket Server Event Handlers ---

wss.on('connection', (ws, req) => {
    // --- Server-Side ID Assignment ---
    const clientId = uuidv4();
    const clientIp = req.socket.remoteAddress;
    console.log(`[Server] New client connected from ${clientIp}, assigned ID: ${clientId}`);

    // Immediately attach the ID and register the client
    ws.clientId = clientId;
    clients.set(clientId, ws);
    
    /**
     * The ID of the room the client is currently in.
     * @type {string|null}
     */
    ws.roomId = null;

    // Inform the client of their new ID
    ws.send(JSON.stringify({ type: 'register-success', id: clientId }));

    broadcastClientList();

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
            // Also close the database connection if no clients are left (optional)
            broadcastClientList();

            // If the client was in a room, notify the other participant.
            if (ws.roomId) {
                const otherParticipant = findOtherParticipant(ws.clientId, ws.roomId);
                if (otherParticipant) {
                    otherParticipant.send(JSON.stringify({ type: 'partner-left-room', roomId: ws.roomId }));
                    otherParticipant.roomId = null; // Reset the other participant's room
                }
            }

            // If the user was typing, notify others they stopped.
            const stopTypingMessage = {
                type: 'user-stopped-typing',
                id: clientId
            };
            const messageString = JSON.stringify(stopTypingMessage);
            broadcastToOthers(clientId, messageString);
        }
    });

    // 3. Handle potential errors
    ws.on('error', (error) => {
        console.error('[Server] WebSocket error:', error);
    });
});

/**
 * Handles graceful shutdown of the server.
 */
async function shutdown() {
    console.log('[Server] Shutting down gracefully...');

    // 1. Close all client connections
    const shutdownMessage = JSON.stringify({ type: 'info', message: 'Server is shutting down.' });
    for (const clientWs of clients.values()) {
        clientWs.send(shutdownMessage, () => clientWs.close(1000, 'Server Shutdown'));
    }
    clients.clear();

    // 2. Close the database connection
    if (mongoClient && mongoClient.topology && mongoClient.topology.isConnected()) {
        await mongoClient.close();
        console.log('[Database] MongoDB connection closed.');
    }

    // 3. Close the servers
    wss.close(() => console.log('[Server] WebSocket server closed.'));
    server.close(() => {
        console.log('[Server] HTTP server closed.');
        process.exit(0);
    });
}

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
 * Broadcasts a message to all clients except the sender.
 * @param {string} senderId The ID of the client who sent the message.
 * @param {string} messageString The stringified message to send.
 */
function broadcastToOthers(senderId, messageString) {
    for (const [id, clientWs] of clients.entries()) {
        // Don't send the message back to the sender
        if (id !== senderId) {
            clientWs.send(messageString);
        }
    }
}

/**
 * Generates a consistent, unique room ID for two client IDs.
 * @param {string} id1 First client ID.
 * @param {string} id2 Second client ID.
 * @returns {string} The generated room ID.
 */
function getRoomId(id1, id2) {
    // Sort the IDs to ensure the room ID is the same regardless of who initiates.
    return [id1, id2].sort().join('-');
}

/**
 * Finds the other client in a given room.
 * @param {string} ownId The ID of the client making the request.
 * @param {string} roomId The ID of the room.
 * @returns {import('ws')|undefined} The WebSocket object of the other participant.
 */
function findOtherParticipant(ownId, roomId) {
    for (const client of clients.values()) {
        if (client.roomId === roomId && client.clientId !== ownId) {
            return client;
        }
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

                // Persist the routed message to the database
                const dbMessage = {
                    _id: uuidv4(),
                    senderId: senderId,
                    recipientId: destinationId,
                    payload: message.payload,
                    isBroadcast: false,
                    timestamp: new Date()
                };
                messagesCollection.insertOne(dbMessage).catch(err => {
                    console.error('[Database] Error saving routed message:', err);
                });

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

            // Persist the broadcast message to the database
            const dbBroadcastMessage = {
                _id: uuidv4(),
                senderId: broadcastSenderId,
                payload: message.payload,
                isBroadcast: true,
                timestamp: new Date()
            };
            messagesCollection.insertOne(dbBroadcastMessage).catch(err => {
                console.error('[Database] Error saving broadcast message:', err);
            });


            console.log(`[Server] Broadcasting message from '${broadcastSenderId}'.`);
            broadcastToOthers(broadcastSenderId, broadcastString);
            break;

        case 'get-history':
            const requesterId = ws.clientId;
            if (!requesterId) {
                ws.send(JSON.stringify({ type: 'error', message: 'Cannot get history: client is not registered.' }));
                return;
            }

            console.log(`[Server] Fetching message history for '${requesterId}'.`);

            // Query for messages sent to the user, from the user, or broadcast to everyone.
            const query = {
                $or: [
                    { recipientId: requesterId },
                    { senderId: requesterId },
                    { isBroadcast: true }
                ]
            };

            // Use the appropriate limit based on whether a DB is connected.
            const historyLimit = mongoClient ? DB_HISTORY_LIMIT : IN_MEMORY_HISTORY_LIMIT;

            messagesCollection.find(query).sort({ timestamp: 1 }).limit(historyLimit).toArray()
                .then(history => {
                    ws.send(JSON.stringify({
                        type: 'message-history',
                        history: history
                    }));
                })
                .catch(err => {
                    console.error(`[Database] Error fetching history for '${requesterId}':`, err);
                    ws.send(JSON.stringify({ type: 'error', message: 'Failed to retrieve message history.' }));
                });
            break;

        case 'start-typing':
            const typingMessage = {
                type: 'user-typing',
                id: ws.clientId
            };
            const typingString = JSON.stringify(typingMessage);
            broadcastToOthers(ws.clientId, typingString);
            break;

        case 'stop-typing':
            const stopTypingMessage = {
                type: 'user-stopped-typing',
                id: ws.clientId
            };
            const stopTypingString = JSON.stringify(stopTypingMessage);
            broadcastToOthers(ws.clientId, stopTypingString);
            break;

        case 'join-room':
            const partnerId = message.with;
            const selfId = ws.clientId;

            if (!partnerId || partnerId === selfId) {
                ws.send(JSON.stringify({ type: 'error', message: 'Invalid partner ID provided.' }));
                return;
            }

            const partnerWs = clients.get(partnerId);
            if (!partnerWs) {
                ws.send(JSON.stringify({ type: 'error', message: `User '${partnerId}' is not online.` }));
                return;
            }

            const roomId = getRoomId(selfId, partnerId);

            // Set the room ID for both participants
            ws.roomId = roomId;
            partnerWs.roomId = roomId;

            // Notify both clients they have joined the room
            const joinMessage = { type: 'joined-room', roomId, with: partnerId };
            ws.send(JSON.stringify(joinMessage));

            const partnerJoinMessage = { type: 'joined-room', roomId, with: selfId };
            partnerWs.send(JSON.stringify(partnerJoinMessage));
            
            console.log(`[Server] Clients '${selfId}' and '${partnerId}' joined room '${roomId}'.`);
            break;

        case 'room-message':
            if (!ws.roomId) {
                ws.send(JSON.stringify({ type: 'error', message: 'You are not in a room.' }));
                return;
            }

            const otherParticipant = findOtherParticipant(ws.clientId, ws.roomId);
            if (otherParticipant) {
                const roomMessage = {
                    type: 'message',
                    from: ws.clientId,
                    payload: message.payload,
                    isBroadcast: false
                };
                otherParticipant.send(JSON.stringify(roomMessage));
            }
            break;

        default:
            console.warn(`[Server] Unknown message type: ${message.type}`);
            ws.send(JSON.stringify({ type: 'error', message: `Unknown message type: '${message.type}'.` }));
    }
}

// --- Initialize Server ---
startServer();
process.on('SIGINT', shutdown); // Catches Ctrl+C
process.on('SIGTERM', shutdown); // Catches kill signals
