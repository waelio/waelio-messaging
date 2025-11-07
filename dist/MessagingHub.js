import { WebSocketServer } from 'ws';
import { MongoClient } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';
const DB_HISTORY_LIMIT = 100;
const IN_MEMORY_HISTORY_LIMIT = 10;
const DB_NAME = 'messagingApp';
export class MessagingHub {
    /**
     * @param {import('http').Server} httpServer The HTTP server to attach the WebSocket server to.
     * @param {HubOptions} [options={}]
     * @param {string} [options.mongoURI] Optional MongoDB connection string for message persistence.
     */
    mongoURI;
    mongoClient;
    messagesCollection; // Allow mock object
    clients = new Map();
    wss;
    ready;
    constructor(httpServer, options = {}) {
        if (!httpServer) {
            throw new Error('An HTTP server instance is required.');
        }
        this.mongoURI = options.mongoURI;
        // Defer MongoClient construction to _setupPersistence so invalid URIs don't crash the app
        this.mongoClient = null;
        this.messagesCollection = null;
        this.wss = new WebSocketServer({ server: httpServer });
        this.ready = this._initialize();
    }
    async _initialize() {
        await this._setupPersistence();
        this.wss.on('connection', (ws, req) => this._handleConnection(ws, req));
        console.log('[MessagingHub] WebSocket server is attached and running.');
    }
    async _setupPersistence() {
        if (this.mongoURI) {
            try {
                this.mongoClient = new MongoClient(this.mongoURI);
                await this.mongoClient.connect();
                console.log('[Database] Connected successfully to MongoDB.');
                const db = this.mongoClient.db(DB_NAME);
                this.messagesCollection = db.collection('messages');
            }
            catch (err) {
                console.error('[Database] ERROR: Could not initialize MongoDB client or connect. Falling back to in-memory store.');
                console.error(err);
                this._setupInMemoryStore();
            }
        }
        else {
            console.warn('[MessagingHub] No mongoURI provided. Running in IN-MEMORY mode.');
            this._setupInMemoryStore();
        }
    }
    _setupInMemoryStore() {
        const inMemoryMessages = [];
        this.messagesCollection = {
            insertOne: async (message) => {
                message._id = uuidv4();
                inMemoryMessages.push(message);
                if (inMemoryMessages.length > IN_MEMORY_HISTORY_LIMIT) {
                    inMemoryMessages.shift();
                }
                return { acknowledged: true, insertedId: message._id };
            },
            find: (query = {}) => {
                let filtered = inMemoryMessages;
                if (query.$or) {
                    const orClauses = query.$or;
                    const recipientId = orClauses.find((c) => c.recipientId)?.recipientId;
                    const senderId = orClauses.find((c) => c.senderId)?.senderId;
                    filtered = inMemoryMessages.filter(msg => msg.isBroadcast || msg.senderId === senderId || msg.recipientId === recipientId);
                }
                return {
                    sort: () => ({ limit: () => ({ toArray: () => Promise.resolve(filtered) }) })
                };
            }
        };
    }
    _handleConnection(ws, req) {
        const clientId = uuidv4();
        const clientIp = req.socket.remoteAddress;
        console.log(`[MessagingHub] New client connected from ${clientIp}, assigned ID: ${clientId}`);
        ws.clientId = clientId;
        this.clients.set(clientId, ws);
        ws.roomId = null;
        ws.send(JSON.stringify({ type: 'register-success', id: clientId }));
        this._broadcastClientList();
        ws.on('message', (message) => {
            try {
                const parsedMessage = JSON.parse(message.toString());
                this._handleClientMessage(ws, parsedMessage);
            }
            catch (error) {
                console.error('[MessagingHub] Error parsing or handling message:', error);
                ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON format.' }));
            }
        });
        ws.on('close', () => this._handleDisconnection(ws));
        ws.on('error', (error) => console.error('[MessagingHub] WebSocket error:', error));
    }
    _handleDisconnection(ws) {
        const clientId = ws.clientId;
        if (!clientId)
            return;
        this.clients.delete(clientId);
        console.log(`[MessagingHub] Client '${clientId}' disconnected.`);
        this._broadcastClientList();
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
        const shutdownMessage = JSON.stringify({ type: 'info', message: 'Server is shutting down.' });
        for (const clientWs of this.clients.values()) {
            clientWs.send(shutdownMessage, () => clientWs.close(1000, 'Server Shutdown'));
        }
        this.clients.clear();
        if (this.mongoClient) {
            await this.mongoClient.close();
            console.log('[Database] MongoDB connection closed.');
        }
        this.wss.close(() => console.log('[MessagingHub] WebSocket server closed.'));
    }
    _broadcastClientList() {
        const clientList = Array.from(this.clients.keys());
        const message = { type: 'user-list', users: clientList };
        const messageString = JSON.stringify(message);
        for (const clientWs of this.clients.values()) {
            clientWs.send(messageString);
        }
    }
    _broadcastToOthers(senderId, messageString) {
        for (const [id, clientWs] of this.clients.entries()) {
            if (id !== senderId) {
                clientWs.send(messageString);
            }
        }
    }
    _getRoomId(id1, id2) {
        return [id1, id2].sort().join('-');
    }
    _findOtherParticipant(ownId, roomId) {
        for (const client of this.clients.values()) {
            if (client.roomId === roomId && client.clientId !== ownId) {
                return client;
            }
        }
    }
    _handleClientMessage(ws, message) {
        console.log('[MessagingHub] Received message:', message);
        const senderId = ws.clientId;
        switch (message.type) {
            case 'route':
                const destinationWs = this.clients.get(message.to);
                if (destinationWs) {
                    const outboundMessage = { type: 'message', from: senderId, payload: message.payload };
                    const dbMessage = { senderId, recipientId: message.to, payload: message.payload, isBroadcast: false, timestamp: new Date() };
                    this.messagesCollection?.insertOne(dbMessage).catch((err) => console.error('[Database] Error saving routed message:', err));
                    destinationWs.send(JSON.stringify(outboundMessage));
                }
                else {
                    ws.send(JSON.stringify({ type: 'error', message: `Client '${message.to}' not found.` }));
                }
                break;
            case 'broadcast':
                const broadcastMessage = { type: 'message', from: senderId, payload: message.payload, isBroadcast: true };
                const dbBroadcastMessage = { senderId, payload: message.payload, isBroadcast: true, timestamp: new Date() };
                this.messagesCollection?.insertOne(dbBroadcastMessage).catch((err) => console.error('[Database] Error saving broadcast message:', err));
                this._broadcastToOthers(senderId, JSON.stringify(broadcastMessage));
                break;
            case 'get-history':
                if (!senderId)
                    return;
                const query = { $or: [{ recipientId: senderId }, { senderId: senderId }, { isBroadcast: true }] };
                const historyLimit = this.mongoClient ? DB_HISTORY_LIMIT : IN_MEMORY_HISTORY_LIMIT;
                this.messagesCollection?.find(query).sort({ timestamp: 1 }).limit(historyLimit).toArray()
                    .then((history) => ws.send(JSON.stringify({ type: 'message-history', history })))
                    .catch((err) => {
                    console.error(`[Database] Error fetching history for '${senderId}':`, err);
                    ws.send(JSON.stringify({ type: 'error', message: 'Failed to retrieve message history.' }));
                });
                break;
            case 'start-typing':
                this._broadcastToOthers(senderId, JSON.stringify({ type: 'user-typing', id: senderId }));
                break;
            case 'stop-typing':
                this._broadcastToOthers(senderId, JSON.stringify({ type: 'user-stopped-typing', id: senderId }));
                break;
            case 'join-room':
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
            case 'room-message':
                if (!ws.roomId) {
                    ws.send(JSON.stringify({ type: 'error', message: 'You are not in a room.' }));
                    return;
                }
                const otherParticipant = this._findOtherParticipant(senderId, ws.roomId);
                if (otherParticipant) {
                    const roomMessage = { type: 'message', from: senderId, payload: message.payload, isBroadcast: false };
                    otherParticipant.send(JSON.stringify(roomMessage));
                }
                break;
            default:
                ws.send(JSON.stringify({ type: 'error', message: `Unknown message type: '${message.type}'.` }));
        }
    }
}
