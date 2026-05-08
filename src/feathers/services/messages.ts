import crypto from 'node:crypto';
import type { MongoClient } from 'mongodb';
import { createLogger } from '../../logger.js';
import { createMongoClient } from '../../mongoClient.js';
import type { IMessagesCollection } from '../../types.js';

const log = createLogger('Messages');

// ── Peace2074 webhook emitter ─────────────────────────────────────────────────
// Set PEACE2074_WEBHOOK_URL and (optionally) PEACE2074_WEBHOOK_SECRET in .env
// to forward every new message to the Nitro API for Web Push delivery.

const PEACE2074_WEBHOOK_URL = process.env.PEACE2074_WEBHOOK_URL ?? '';
const PEACE2074_WEBHOOK_SECRET = process.env.PEACE2074_WEBHOOK_SECRET ?? '';

async function emitToWebhook(message: Record<string, unknown>): Promise<void> {
    if (!PEACE2074_WEBHOOK_URL) return;
    try {
        const body = JSON.stringify(message);
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (PEACE2074_WEBHOOK_SECRET) {
            headers['x-webhook-signature'] =
                'sha256=' + crypto.createHmac('sha256', PEACE2074_WEBHOOK_SECRET).update(body).digest('hex');
        }
        const res = await fetch(PEACE2074_WEBHOOK_URL, { method: 'POST', headers, body });
        if (!res.ok) {
            log.warn({ status: res.status }, 'Webhook POST failed.');
        }
    } catch (err) {
        log.warn({ err }, 'Webhook POST error.');
    }
}

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
type MessageDoc = {
    _id: string;
    type: string;
    payload: unknown;
    senderId: string;
    recipientId: string | null;
    roomId: string | null;
    isBroadcast: boolean;
    timestamp: Date;
};

export class MessagesService {
    private mongoClient: MongoClient | null = null;
    private collection: IMessagesCollection<MessageDoc> | null = null;
    public ready: Promise<void>;

    constructor(mongoURI?: string) {
        this.ready = this._setup(mongoURI);
    }

    // ── Persistence setup ────────────────────────────────────────────────────

    private async _setup(mongoURI?: string) {
        if (mongoURI) {
            try {
                this.mongoClient = createMongoClient(mongoURI);
                await this.mongoClient.connect();
                this.collection = this.mongoClient.db(DB_NAME).collection('messages');
                log.info('Connected to MongoDB.');
                return;
            } catch (err) {
                log.error({ err }, 'MongoDB failed, falling back to in-memory store.');
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
            find: (query: any = {}) => {
                let filtered: any[] = query.$or
                    ? (() => {
                        const ids = (query.$or as any[]).flatMap((c) => Object.values(c) as string[]);
                        return store.filter(
                            (m) => m.isBroadcast || ids.includes(m.senderId) || ids.includes(m.recipientId)
                        );
                    })()
                    : [...store];

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
                                toArray: async () => filtered.slice(0, n),
                            }),
                        };
                    },
                };
            },
        };
        log.warn('No mongoURI provided. Using in-memory store.');
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
            _id: crypto.randomUUID(),
            type: data.type,           // 'route' | 'broadcast' | 'room-message'
            payload: data.payload,
            senderId,
            recipientId: data.to ?? null,
            roomId: data.type === 'room-message' ? roomId ?? null : null,
            isBroadcast: data.type === 'broadcast',
            timestamp: new Date(),
        };

        await this.collection?.insertOne({ ...message });

        // Fire-and-forget: notify Peace2074 Nitro API for Web Push delivery
        void emitToWebhook(message);

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

        if (!this.collection) return [];
        return this.collection.find(query).sort({ timestamp: 1 }).limit(limit).toArray();
    }

    async close() {
        if (this.mongoClient) {
            await this.mongoClient.close();
        }
    }
}
