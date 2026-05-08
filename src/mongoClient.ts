import { MongoClient, type MongoClientOptions } from 'mongodb';

const DEFAULT_MONGO_TIMEOUT_MS = 2500;

function parsePositiveInteger(value: string | undefined, fallback: number): number {
    const parsed = Number.parseInt(value ?? '', 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const serverSelectionTimeoutMS = parsePositiveInteger(
    process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS,
    DEFAULT_MONGO_TIMEOUT_MS,
);
const connectTimeoutMS = parsePositiveInteger(
    process.env.MONGO_CONNECT_TIMEOUT_MS,
    DEFAULT_MONGO_TIMEOUT_MS,
);

export function createMongoClient(uri: string, options: MongoClientOptions = {}): MongoClient {
    return new MongoClient(uri, {
        serverSelectionTimeoutMS,
        connectTimeoutMS,
        ...options,
    });
}
