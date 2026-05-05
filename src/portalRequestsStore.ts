import { MongoClient } from 'mongodb';
import crypto from 'node:crypto';

const DB_NAME = 'messagingApp';
const COLLECTION_NAME = 'portalRequests';
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;
const IN_MEMORY_LIMIT = 500;

type PortalRequestAttachment = {
    fileName: string;
    contentType: string;
    storageRef: string;
};

export type PortalRequestStatus = 'submitted' | 'imported' | 'started';

type PortalRequestStatusUpdate = {
    status: PortalRequestStatus;
    hostDisplayName?: string;
    sessionCode?: string;
};

type PortalRequestDocument = {
    requestId: string;
    createdAt: Date;
    source: 'welcomtalk-portal';
    fullName: string;
    topic: string;
    summary: string;
    additionalNotes: string;
    status: PortalRequestStatus;
    attachments: PortalRequestAttachment[];
    importedAt?: Date;
    startedAt?: Date;
    hostDisplayName?: string;
    sessionCode?: string;
    expiresAt: Date;
};

export type PortalRequestRecord = {
    requestId: string;
    createdAt: string;
    source: 'welcomtalk-portal';
    fullName: string;
    topic: string;
    summary: string;
    additionalNotes: string;
    status: PortalRequestStatus;
    attachments: PortalRequestAttachment[];
    importedAt?: string;
    startedAt?: string;
    hostDisplayName?: string;
    sessionCode?: string;
    expiresAt: string;
};

const STATUS_PRECEDENCE: Record<PortalRequestStatus, number> = {
    submitted: 0,
    imported: 1,
    started: 2,
};

export class PortalRequestsStore {
    private mongoClient: MongoClient | null = null;
    private collection: any = null;
    private memoryStore = new Map<string, PortalRequestRecord>();
    public ready: Promise<void>;

    constructor(mongoURI?: string) {
        this.ready = this.setup(mongoURI);
    }

    private async setup(mongoURI?: string) {
        if (mongoURI) {
            try {
                this.mongoClient = new MongoClient(mongoURI);
                await this.mongoClient.connect();
                this.collection = this.mongoClient.db(DB_NAME).collection(COLLECTION_NAME);
                await this.collection.createIndex({ requestId: 1 }, { unique: true });
                await this.collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
                console.log('[PortalRequests] Connected to MongoDB');
                return;
            } catch (error) {
                console.error('[PortalRequests] MongoDB failed, falling back to in-memory store', error);
            }
        }

        console.log('[PortalRequests] Using in-memory store');
    }

    private normalizeDocument(input: any): PortalRequestDocument {
        const requestId = typeof input?.requestId === 'string' && input.requestId.trim()
            ? input.requestId.trim()
            : crypto.randomUUID();
        const createdAt = typeof input?.createdAt === 'string' && !Number.isNaN(Date.parse(input.createdAt))
            ? new Date(input.createdAt)
            : new Date();
        const fullName = typeof input?.fullName === 'string' ? input.fullName.trim() : '';
        const topic = typeof input?.topic === 'string' ? input.topic.trim() : '';
        const summary = typeof input?.summary === 'string' ? input.summary.trim() : '';
        const additionalNotes = typeof input?.additionalNotes === 'string'
            ? input.additionalNotes.trim()
            : '';

        if (!fullName || !topic || !summary) {
            throw new Error('Portal request must include fullName, topic, and summary.');
        }

        const attachments = Array.isArray(input?.attachments)
            ? input.attachments.reduce((items: PortalRequestAttachment[], attachment: any) => {
                const fileName = typeof attachment?.fileName === 'string' ? attachment.fileName.trim() : '';
                const contentType = typeof attachment?.contentType === 'string' ? attachment.contentType.trim() : '';
                const storageRef = typeof attachment?.storageRef === 'string' ? attachment.storageRef.trim() : '';

                if (!fileName || !contentType || !storageRef) {
                    return items;
                }

                items.push({ fileName, contentType, storageRef });
                return items;
            }, [])
            : [];

        return {
            requestId,
            createdAt,
            source: 'welcomtalk-portal',
            fullName,
            topic,
            summary,
            additionalNotes,
            status: 'submitted',
            attachments,
            expiresAt: new Date(createdAt.getTime() + DEFAULT_TTL_MS),
        };
    }

    private toRecord(document: PortalRequestDocument | Record<string, any>): PortalRequestRecord {
        const createdAt = document.createdAt instanceof Date
            ? document.createdAt.toISOString()
            : new Date(document.createdAt).toISOString();
        const expiresAt = document.expiresAt instanceof Date
            ? document.expiresAt.toISOString()
            : new Date(document.expiresAt).toISOString();
        const importedAt = document.importedAt instanceof Date
            ? document.importedAt.toISOString()
            : document.importedAt
                ? new Date(document.importedAt).toISOString()
                : undefined;
        const startedAt = document.startedAt instanceof Date
            ? document.startedAt.toISOString()
            : document.startedAt
                ? new Date(document.startedAt).toISOString()
                : undefined;

        return {
            requestId: String(document.requestId),
            createdAt,
            source: 'welcomtalk-portal',
            fullName: String(document.fullName ?? ''),
            topic: String(document.topic ?? ''),
            summary: String(document.summary ?? ''),
            additionalNotes: String(document.additionalNotes ?? ''),
            status: (document.status as PortalRequestStatus) ?? 'submitted',
            attachments: Array.isArray(document.attachments) ? document.attachments : [],
            importedAt,
            startedAt,
            hostDisplayName: typeof document.hostDisplayName === 'string' ? document.hostDisplayName : undefined,
            sessionCode: typeof document.sessionCode === 'string' ? document.sessionCode : undefined,
            expiresAt,
        };
    }

    private normalizeStatusUpdate(input: any): PortalRequestStatusUpdate {
        const status = typeof input?.status === 'string'
            ? input.status.trim().toLowerCase()
            : '';

        if (status !== 'submitted' && status !== 'imported' && status !== 'started') {
            throw new Error('Portal request status must be one of: submitted, imported, started.');
        }

        const hostDisplayName = typeof input?.hostDisplayName === 'string' && input.hostDisplayName.trim()
            ? input.hostDisplayName.trim()
            : undefined;
        const sessionCode = typeof input?.sessionCode === 'string' && input.sessionCode.trim()
            ? input.sessionCode.trim()
            : undefined;

        return {
            status,
            hostDisplayName,
            sessionCode,
        };
    }

    private cleanupExpiredMemory() {
        const now = Date.now();

        for (const [requestId, record] of this.memoryStore.entries()) {
            if (Date.parse(record.expiresAt) <= now) {
                this.memoryStore.delete(requestId);
            }
        }

        while (this.memoryStore.size > IN_MEMORY_LIMIT) {
            const oldestKey = this.memoryStore.keys().next().value;

            if (!oldestKey) {
                break;
            }

            this.memoryStore.delete(oldestKey);
        }
    }

    async create(input: any): Promise<PortalRequestRecord> {
        const document = this.normalizeDocument(input);

        if (this.collection) {
            await this.collection.updateOne(
                { requestId: document.requestId },
                { $set: document },
                { upsert: true },
            );

            return this.toRecord(document);
        }

        this.cleanupExpiredMemory();

        const record = this.toRecord(document);
        this.memoryStore.set(record.requestId, record);

        this.cleanupExpiredMemory();
        return record;
    }

    async get(requestId: string): Promise<PortalRequestRecord | null> {
        const normalizedRequestId = requestId.trim();

        if (!normalizedRequestId) {
            return null;
        }

        if (this.collection) {
            const document = await this.collection.findOne(
                {
                    requestId: normalizedRequestId,
                    expiresAt: { $gt: new Date() },
                },
                { projection: { _id: 0 } },
            );

            return document ? this.toRecord(document) : null;
        }

        this.cleanupExpiredMemory();
        return this.memoryStore.get(normalizedRequestId) ?? null;
    }

    async updateStatus(requestId: string, input: any): Promise<PortalRequestRecord | null> {
        const normalizedRequestId = requestId.trim();

        if (!normalizedRequestId) {
            return null;
        }

        const update = this.normalizeStatusUpdate(input);
        const existing = await this.get(normalizedRequestId);

        if (!existing) {
            return null;
        }

        const effectiveStatus = STATUS_PRECEDENCE[update.status] >= STATUS_PRECEDENCE[existing.status]
            ? update.status
            : existing.status;
        const now = new Date();

        const nextRecord: PortalRequestRecord = {
            ...existing,
            status: effectiveStatus,
            importedAt: existing.importedAt,
            startedAt: existing.startedAt,
            hostDisplayName: update.hostDisplayName ?? existing.hostDisplayName,
            sessionCode: update.sessionCode ?? existing.sessionCode,
        };

        if (effectiveStatus === 'imported' && !nextRecord.importedAt) {
            nextRecord.importedAt = now.toISOString();
        }

        if (effectiveStatus === 'started') {
            nextRecord.importedAt = nextRecord.importedAt ?? now.toISOString();
            nextRecord.startedAt = nextRecord.startedAt ?? now.toISOString();
        }

        if (this.collection) {
            const updateDocument: Record<string, unknown> = {
                status: nextRecord.status,
                importedAt: nextRecord.importedAt ? new Date(nextRecord.importedAt) : undefined,
                startedAt: nextRecord.startedAt ? new Date(nextRecord.startedAt) : undefined,
                hostDisplayName: nextRecord.hostDisplayName,
                sessionCode: nextRecord.sessionCode,
            };

            Object.keys(updateDocument).forEach((key) => {
                if (updateDocument[key] === undefined) {
                    delete updateDocument[key];
                }
            });

            await this.collection.updateOne(
                { requestId: normalizedRequestId },
                { $set: updateDocument },
            );

            return this.get(normalizedRequestId);
        }

        this.cleanupExpiredMemory();
        this.memoryStore.set(normalizedRequestId, nextRecord);
        return nextRecord;
    }

    async close() {
        if (this.mongoClient) {
            await this.mongoClient.close();
        }
    }
}