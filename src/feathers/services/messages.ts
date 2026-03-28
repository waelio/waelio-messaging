import { MongoClient } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';

const DB_NAME = 'messagingApp';
const DB_HISTORY_LIMIT = 1000;
const IN_MEMORY_LIMIT = 100;

/**
 * Feathers-compatible messages service.
 *
 * Replaces the route/broadcast/get-history cases of _handleClientMessage.
 *
 * create(data, params)  — persist and return the message; channels.ts
 *                         decides who receives the 'created' event.
 * find(params)          — return history for the calling client.
 */
export class MessagesService {
    private mongoClient: MongoClient | null = null;
    private collection: any = null;
    public ready: Promise<void>;

    constructor(mongoURI?: string) {
        this.ready = this._setup(mongoURI);
    }

    // ── Persistence setup ────────────────────────────────────────────────────

    private async _setup(mongoURI?: string) {
        if (mongoURI) {
            try {
                this.mongoClient = new MongoClient(mongoURI);
                await this.mongoClient.connect();
                this.collection = this.mongoClient.db(DB_NAME).collection('messages');
                console.log('[Messages] Connected to MongoDB');
                return;
            } catch (err) {
                console.error('[Messages] MongoDB failed, falling back to in-memory store', err);
            }
        }
        this._setupInMemory();
    }

    private _setupInMemory() {
        const store: any[] = [];
        this.collection = {
            insertOne: async (doc: any) => {
                store.push(doc);
                if (store.length > IN_MEMORY_LIMIT) store.shift();
                return doc;
            },
            find: (query: any = {}) => ({
                sort: () => ({
                    limit: () => ({
                        toArray: async (): Promise<any[]> => {
                            if (!query.$or) return [...store];
                            const ids = (query.$or as any[]).flatMap((c) =>
                                Object.values(c) as string[]
                            );
                            return store.filter(
                                (m) =>
                                    m.isBroadcast ||
                                    ids.includes(m.senderId) ||
                                    ids.includes(m.recipientId)
                            );
                        },
                    }),
                }),
            }),
        };
        console.log('[Messages] Using in-memory store');
    }

    // ── Feathers service methods ─────────────────────────────────────────────

    /**
     * Create a message. Called when a client emits 'messages::create'.
     * The returned object is what channels.ts routes to the right subscribers.
     */
    async create(data: any, params?: any): Promise<any> {
        const senderId: string = (params?.connection as any)?.clientId ?? 'server';
        const roomId: string | undefined = (params?.connection as any)?.roomId;

        const message = {
            _id: uuidv4(),
            type: data.type,           // 'route' | 'broadcast' | 'room-message'
            payload: data.payload,
            senderId,
            recipientId: data.to ?? null,
            roomId: data.type === 'room-message' ? roomId ?? null : null,
            isBroadcast: data.type === 'broadcast',
            timestamp: new Date(),
        };

        await this.collection.insertOne({ ...message });
        return message;
    }

    /**
     * Return message history for the calling client.
     * Called when a client emits 'messages::find'.
     */
    async find(params?: any): Promise<any[]> {
        const senderId: string | undefined = (params?.connection as any)?.clientId;
        const limit = this.mongoClient ? DB_HISTORY_LIMIT : IN_MEMORY_LIMIT;

        const query = senderId
            ? { $or: [{ recipientId: senderId }, { senderId }, { isBroadcast: true }] }
            : {};

        return this.collection.find(query).sort({ timestamp: 1 }).limit(limit).toArray();
    }

    async close() {
        if (this.mongoClient) {
            await this.mongoClient.close();
        }
    }
}
