import type { Server as HttpServer } from 'http';
import type { IncomingMessage } from 'http';
import type { Db } from 'mongodb';
import type { WebSocket } from 'ws';
import type { IMessagesCollection } from './types.js';

import { WebSocketServer } from 'ws';
import { MongoClient } from 'mongodb';

// --- Type Definitions ---

interface HubOptions {
    mongoURI?: string;
    /** Shared secret token required in the WebSocket upgrade URL as `?token=<secret>`. When omitted, all connections are accepted. */
    secret?: string;
}

type ClientMessage =
    | { type: 'route'; to: string; payload: unknown }
    | { type: 'broadcast'; payload: unknown }
    | { type: 'get-history' }
    | { type: 'join-room'; with: string }
    | { type: 'room-message'; payload: unknown }
    | { type: 'start-typing' }
    | { type: 'stop-typing' };

interface ExtendedWebSocket extends WebSocket {
    clientId: string;
    roomId: string | null;
    isAlive: boolean;
}

interface Message {
    _id?: any;
    senderId: string;
    recipientId?: string;
    roomId?: string;
    payload: any;
    isBroadcast: boolean;
    timestamp: Date;
}

const DB_HISTORY_LIMIT = 1000;
const IN_MEMORY_HISTORY_LIMIT = 100;
const DB_NAME = 'messagingApp';
const HEARTBEAT_INTERVAL_MS = 30_000;

export class MessagingHub {
    /**
     * @param {import('http').Server} httpServer The HTTP server to attach the WebSocket server to.
     * @param {HubOptions} [options={}]
     * @param {string} [options.mongoURI] Optional MongoDB connection string for message persistence.
     */
    private mongoURI?: string;
    private secret?: string;
    private mongoClient: MongoClient | null;
    private messagesCollection: IMessagesCollection<Message> | null;
    private clients: Map<string, ExtendedWebSocket> = new Map();
    private wss: WebSocketServer;
    private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
    public ready: Promise<void>;

    constructor(httpServer: HttpServer, options: HubOptions = {}) {
        if (!httpServer) {
            throw new Error('An HTTP server instance is required.');
        }

        this.mongoURI = options.mongoURI;
        this.secret = options.secret;
        // Defer MongoClient construction to _setupPersistence so invalid URIs don't crash the app
        this.mongoClient = null;
        this.messagesCollection = null;

        const verifyClient = this.secret
            ? (info: { req: IncomingMessage }, cb: (res: boolean, code?: number, message?: string) => void) => {
                const url = new URL(info.req.url ?? '/', 'http://localhost');
                const token = url.searchParams.get('token');
                if (token === this.secret) {
                    cb(true);
                } else {
                    console.warn('[MessagingHub] Rejected unauthorized connection attempt.');
                    cb(false, 401, 'Unauthorized');
                }
            }
            : undefined;

        this.wss = new WebSocketServer({ server: httpServer, verifyClient });

        this.ready = this._initialize();
    }

    private async _initialize(): Promise<void> {
        await this._setupPersistence();
        this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => this._handleConnection(ws as ExtendedWebSocket, req));
        this.heartbeatInterval = setInterval(() => this._pingClients(), HEARTBEAT_INTERVAL_MS);
        console.log('[MessagingHub] WebSocket server is attached and running.');
    }

    private _pingClients(): void {
        for (const ws of this.clients.values()) {
            if (!ws.isAlive) {
                console.warn(`[MessagingHub] Client '${ws.clientId}' did not respond to ping — terminating.`);
                ws.terminate();
                return;
            }
            ws.isAlive = false;
            ws.ping();
        }
    }

    private async _setupPersistence() {
        if (this.mongoURI) {
            try {
                this.mongoClient = new MongoClient(this.mongoURI);
                await this.mongoClient.connect();
                console.log('[Database] Connected successfully to MongoDB.');
                const db: Db = this.mongoClient.db(DB_NAME);
                this.messagesCollection = db.collection('messages');
            } catch (err) {
                console.error('[Database] ERROR: Could not initialize MongoDB client or connect. Falling back to in-memory store.');
                console.error(err);
                this._setupInMemoryStore();
            }
        } else {
            console.warn('[MessagingHub] No mongoURI provided. Running in IN-MEMORY mode.');
            this._setupInMemoryStore();
        }
    }

    private _setupInMemoryStore() {
        const inMemoryMessages: Message[] = [];
        this.messagesCollection = { // Mocking the Collection interface for in-memory operations
            insertOne: async (message: Message) => {
                message._id = crypto.randomUUID();
                inMemoryMessages.push(message);
                if (inMemoryMessages.length > IN_MEMORY_HISTORY_LIMIT) {
                    inMemoryMessages.shift();
                }
                return { acknowledged: true, insertedId: message._id };
            },
            find: (query: any = {}) => {
                let filtered: Message[] = query.$or
                    ? (() => {
                        const ids: string[] = (query.$or as any[]).flatMap((c: any) => Object.values(c) as string[]);
                        return inMemoryMessages.filter(m => m.isBroadcast || ids.includes(m.senderId) || ids.includes(m.recipientId ?? ''));
                    })()
                    : [...inMemoryMessages];

                return {
                    sort: (spec: Record<string, 1 | -1>) => {
                        const [field, dir] = Object.entries(spec)[0] ?? ['timestamp', 1 as const];
                        filtered = [...filtered].sort((a: any, b: any) => {
                            const av = a[field] instanceof Date ? (a[field] as Date).getTime() : a[field];
                            const bv = b[field] instanceof Date ? (b[field] as Date).getTime() : b[field];
                            return dir === 1 ? av - bv : bv - av;
                        });
                        return {
                            limit: (n: number) => ({
                                toArray: () => Promise.resolve(filtered.slice(0, n))
                            })
                        };
                    }
                };
            }
        };
    }

    private _handleConnection(ws: ExtendedWebSocket, req: IncomingMessage) {
        const clientId = crypto.randomUUID();
        const clientIp = req.socket.remoteAddress;
        console.log(`[MessagingHub] New client connected from ${clientIp}, assigned ID: ${clientId}`);

        ws.clientId = clientId;
        ws.isAlive = true;
        this.clients.set(clientId, ws);
        ws.roomId = null;

        ws.on('pong', () => { ws.isAlive = true; });

        ws.send(JSON.stringify({ type: 'register-success', id: clientId }));
        this._broadcastClientList();
        // Notify other clients a user joined (no persistence, lightweight system event)
        this._broadcastToOthers(clientId, JSON.stringify({ type: 'user-joined', id: clientId, ts: Date.now() }));

        ws.on('message', (message) => {
            try {
                const parsedMessage: ClientMessage = JSON.parse(message.toString());
                this._handleClientMessage(ws, parsedMessage);
            } catch (error) {
                console.error('[MessagingHub] Error parsing or handling message:', error);
                ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON format.' }));
            }
        });

        ws.on('close', () => this._handleDisconnection(ws));
        ws.on('error', (error) => console.error('[MessagingHub] WebSocket error:', error));
    }

    private _handleDisconnection(ws: ExtendedWebSocket) {
        const clientId = ws.clientId;
        if (!clientId) return;

        this.clients.delete(clientId);
        console.log(`[MessagingHub] Client '${clientId}' disconnected.`);
        this._broadcastClientList();
        // Notify others this user left
        this._broadcastToOthers(clientId, JSON.stringify({ type: 'user-left', id: clientId, ts: Date.now() }));

        if (ws.roomId) {
            const otherParticipant = this._findOtherParticipant(ws.clientId, ws.roomId);
            if (otherParticipant) {
                otherParticipant.send(JSON.stringify({ type: 'partner-left-room', roomId: ws.roomId }));
                otherParticipant.roomId = null;
            }
        }

        const stopTypingMessage = { type: 'user-stopped-typing', id: clientId };
        this._broadcastToOthers(clientId, JSON.stringify(stopTypingMessage));
    }

    async shutdown() {
        console.log('[MessagingHub] Shutting down gracefully...');
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
        const shutdownMessage = JSON.stringify({ type: 'info', message: 'Server is shutting down.' });
        for (const clientWs of this.clients.values()) {
            clientWs.send(shutdownMessage, () => (clientWs as WebSocket).close(1000, 'Server Shutdown'));
        }
        this.clients.clear();

        if (this.mongoClient) {
            await this.mongoClient.close();
            console.log('[Database] MongoDB connection closed.');
        }

        this.wss.close(() => console.log('[MessagingHub] WebSocket server closed.'));
    }

    private _broadcastClientList() {
        const clientList = Array.from(this.clients.keys());
        const message = { type: 'user-list', users: clientList };
        const messageString = JSON.stringify(message);
        for (const clientWs of this.clients.values()) {
            clientWs.send(messageString);
        }
    }

    private _broadcastToOthers(senderId: string, messageString: string) {
        for (const [id, clientWs] of this.clients.entries()) {
            if (id !== senderId) {
                clientWs.send(messageString);
            }
        }
    }

    private _getRoomId(id1: string, id2: string): string {
        return [id1, id2].sort().join('-');
    }

    private _findOtherParticipant(ownId: string, roomId: string): ExtendedWebSocket | undefined {
        for (const client of this.clients.values()) {
            if (client.roomId === roomId && client.clientId !== ownId) {
                return client;
            }
        }
    }

    private _handleClientMessage(ws: ExtendedWebSocket, message: ClientMessage) {
        console.log('[MessagingHub] Received message:', message);
        const senderId = ws.clientId;

        switch (message.type) {
            case 'route': {
                const destinationWs = this.clients.get(message.to);
                if (destinationWs) {
                    const outboundMessage = { type: 'message', from: senderId, payload: message.payload };
                    const dbMessage: Message = { senderId, recipientId: message.to, payload: message.payload, isBroadcast: false, timestamp: new Date() };
                    this.messagesCollection?.insertOne(dbMessage).catch((err: any) => console.error('[Database] Error saving routed message:', err));
                    destinationWs.send(JSON.stringify(outboundMessage));
                } else {
                    ws.send(JSON.stringify({ type: 'error', message: `Client '${message.to}' not found.` }));
                }
                break;
            }

            case 'broadcast': {
                const broadcastMessage = { type: 'message', from: senderId, payload: message.payload, isBroadcast: true };
                const dbBroadcastMessage: Message = { senderId, payload: message.payload, isBroadcast: true, timestamp: new Date() };
                this.messagesCollection?.insertOne(dbBroadcastMessage).catch((err: any) => console.error('[Database] Error saving broadcast message:', err));
                this._broadcastToOthers(senderId, JSON.stringify(broadcastMessage));
                break;
            }

            case 'get-history': {
                if (!senderId) return;
                const query = { $or: [{ recipientId: senderId }, { senderId: senderId }, { isBroadcast: true }] };
                const historyLimit = this.mongoClient ? DB_HISTORY_LIMIT : IN_MEMORY_HISTORY_LIMIT;
                this.messagesCollection?.find(query).sort({ timestamp: 1 }).limit(historyLimit).toArray()
                    .then((history: any) => ws.send(JSON.stringify({ type: 'message-history', history })))
                    .catch((err: any) => {
                        console.error(`[Database] Error fetching history for '${senderId}':`, err);
                        ws.send(JSON.stringify({ type: 'error', message: 'Failed to retrieve message history.' }));
                    });
                break;
            }

            case 'start-typing': {
                this._broadcastToOthers(senderId, JSON.stringify({ type: 'user-typing', id: senderId }));
                break;
            }

            case 'stop-typing': {
                this._broadcastToOthers(senderId, JSON.stringify({ type: 'user-stopped-typing', id: senderId }));
                break;
            }

            case 'join-room': {
                const partnerId = message.with;
                if (!partnerId || partnerId === senderId) {
                    ws.send(JSON.stringify({ type: 'error', message: 'Invalid partner ID.' }));
                    return;
                }
                const partnerWs = this.clients.get(partnerId);
                if (!partnerWs) {
                    ws.send(JSON.stringify({ type: 'error', message: `User '${partnerId}' is not online.` }));
                    return;
                }
                const roomId = this._getRoomId(senderId, partnerId);
                ws.roomId = roomId;
                partnerWs.roomId = roomId;
                ws.send(JSON.stringify({ type: 'joined-room', roomId, with: partnerId }));
                partnerWs.send(JSON.stringify({ type: 'joined-room', roomId, with: senderId }));
                console.log(`[MessagingHub] Clients '${senderId}' and '${partnerId}' joined room '${roomId}'.`);
                break;
            }

            case 'room-message': {
                if (!ws.roomId) {
                    ws.send(JSON.stringify({ type: 'error', message: 'You are not in a room.' }));
                    return;
                }
                const dbRoomMessage: Message = { senderId, roomId: ws.roomId, payload: message.payload, isBroadcast: false, timestamp: new Date() };
                this.messagesCollection?.insertOne(dbRoomMessage).catch((err: any) => console.error('[Database] Error saving room message:', err));
                const otherParticipant = this._findOtherParticipant(senderId, ws.roomId);
                if (otherParticipant) {
                    const roomMessage = { type: 'message', from: senderId, payload: message.payload, roomId: ws.roomId, isBroadcast: false };
                    otherParticipant.send(JSON.stringify(roomMessage));
                }
                break;
            }

            default: {
                const _exhaustive: never = message;
                void _exhaustive;
                ws.send(JSON.stringify({ type: 'error', message: 'Unknown message type.' }));
            }
        }
    }

    /**
     * Send a direct message to a connected client by ID.
     * Returns true if delivered, false if client not found.
     */
    async sendToClient(recipientId: string, payload: any, from: string = 'api'): Promise<boolean> {
        const destinationWs = this.clients.get(recipientId);
        if (!destinationWs) return false;

        const outboundMessage = { type: 'message', from, payload };
        const dbMessage: Message = { senderId: from, recipientId, payload, isBroadcast: false, timestamp: new Date() };
        this.messagesCollection?.insertOne(dbMessage).catch((err: any) => console.error('[Database] Error saving routed message:', err));
        destinationWs.send(JSON.stringify(outboundMessage));
        return true;
    }

    /**
     * Broadcast a message to all clients except optional senderId.
     */
    async broadcast(payload: any, from: string = 'api', excludeId?: string): Promise<void> {
        const broadcastMessage = { type: 'message', from, payload, isBroadcast: true };
        const dbBroadcastMessage: Message = { senderId: from, payload, isBroadcast: true, timestamp: new Date() };
        this.messagesCollection?.insertOne(dbBroadcastMessage).catch((err: any) => console.error('[Database] Error saving broadcast message:', err));
        for (const [id, clientWs] of this.clients.entries()) {
            if (excludeId && id === excludeId) continue;
            clientWs.send(JSON.stringify(broadcastMessage));
        }
    }

    /**
     * Get the list of currently connected client IDs.
     */
    getConnectedUsers(): string[] {
        return Array.from(this.clients.keys());
    }
}