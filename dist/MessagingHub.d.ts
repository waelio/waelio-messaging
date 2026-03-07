import type { Server as HttpServer } from 'http';
interface HubOptions {
    mongoURI?: string;
}
export declare class MessagingHub {
    /**
     * @param {import('http').Server} httpServer The HTTP server to attach the WebSocket server to.
     * @param {HubOptions} [options={}]
     * @param {string} [options.mongoURI] Optional MongoDB connection string for message persistence.
     */
    private mongoURI?;
    private mongoClient;
    private messagesCollection;
    private clients;
    private wss;
    ready: Promise<void>;
    constructor(httpServer: HttpServer, options?: HubOptions);
    private _initialize;
    private _setupPersistence;
    private _setupInMemoryStore;
    private _handleConnection;
    private _handleDisconnection;
    shutdown(): Promise<void>;
    private _broadcastClientList;
    private _broadcastToOthers;
    private _getRoomId;
    private _findOtherParticipant;
    private _handleClientMessage;
    /**
     * Send a direct message to a connected client by ID.
     * Returns true if delivered, false if client not found.
     */
    sendToClient(recipientId: string, payload: any, from?: string): Promise<boolean>;
    /**
     * Broadcast a message to all clients except optional senderId.
     */
    broadcast(payload: any, from?: string, excludeId?: string): Promise<void>;
}
export {};
