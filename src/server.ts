import 'dotenv/config';
import express, { type Request } from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { createLogger } from './logger.js';
import { createFeathersApp } from './feathers/app.js';
import { extractPortalRequestSyncUpdate, verifyGitHubWebhookSignature } from './githubWebhook.js';
import { PortalRequestsStore } from './portalRequestsStore.js';

const log = createLogger('Server');
const JSON_BODY_LIMIT = '256kb';

type RawBodyRequest = Request & { rawBody?: Buffer };

let portalRequestsStore: PortalRequestsStore | null = null;

function getAllowedOrigins(): string[] {
    return (process.env.ALLOWED_ORIGINS || '')
        .split(',')
        .map(origin => origin.trim())
        .filter(Boolean);
}

function shouldUseMongo(): boolean {
    return process.env.NODE_ENV !== 'test' || process.env.USE_MONGO_IN_TESTS === 'true';
}

function getMongoURI(): string | undefined {
    const mongoURI = process.env.MONGO_URI?.trim();
    return shouldUseMongo() && mongoURI ? mongoURI : undefined;
}

function getPortalRequestsStore(): PortalRequestsStore {
    if (!portalRequestsStore) {
        portalRequestsStore = new PortalRequestsStore(getMongoURI());
    }

    return portalRequestsStore;
}

function getGithubWebhookSecret(): string {
    return process.env.GITHUB_WEBHOOK_SECRET?.trim() ?? '';
}

// --- HTTP Server Setup with Express (static files only) ---
const app = express();
const server = http.createServer(app);

export { app, server };

const githubWebhookJson = express.json({
    limit: JSON_BODY_LIMIT,
    type: ['application/json', 'application/*+json'],
    verify: (req, _res, buf) => {
        (req as RawBodyRequest).rawBody = Buffer.from(buf);
    },
});

const isAllowedOrigin = (origin: string): boolean =>
    !origin || getAllowedOrigins().length === 0 || getAllowedOrigins().includes(origin);

// CORS for HTTP polling leg of Socket.io
app.use((req, res, next) => {
    const origin = req.headers.origin || '';

    if (origin && isAllowedOrigin(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    }

    if (req.method === 'OPTIONS') {
        res.sendStatus(origin && !isAllowedOrigin(origin) ? 403 : 204);
        return;
    }

    next();
});

app.post('/api/github/webhook', githubWebhookJson, async (req, res) => {
    try {
        const eventName = String(req.headers['x-github-event'] ?? '').trim();
        const signatureHeader = Array.isArray(req.headers['x-hub-signature-256'])
            ? req.headers['x-hub-signature-256'][0]
            : req.headers['x-hub-signature-256'];
        const githubWebhookSecret = getGithubWebhookSecret();
        const rawRequest = req as RawBodyRequest;

        if (!eventName) {
            res.status(400).json({ error: 'Missing X-GitHub-Event header.' });
            return;
        }

        if (githubWebhookSecret && !rawRequest.rawBody) {
            res.status(400).json({ error: 'Missing raw request body for signature verification.' });
            return;
        }

        if (
            githubWebhookSecret
            && !verifyGitHubWebhookSignature(rawRequest.rawBody ?? Buffer.from(''), signatureHeader, githubWebhookSecret)
        ) {
            log.warn({ eventName }, 'Rejected GitHub webhook with invalid signature.');
            res.status(401).json({ error: 'Invalid GitHub webhook signature.' });
            return;
        }

        res.setHeader('Cache-Control', 'no-store');

        if (eventName === 'ping') {
            res.json({ ok: true, event: eventName });
            return;
        }

        const syncUpdate = extractPortalRequestSyncUpdate(eventName, req.body ?? {});

        if (!syncUpdate) {
            res.status(202).json({
                ok: true,
                synced: false,
                event: eventName,
                reason: 'No portal request reference found in the GitHub payload.',
            });
            return;
        }

        const portalStore = getPortalRequestsStore();
        await portalStore.ready;

        const record = await portalStore.updateStatus(syncUpdate.requestId, {
            status: syncUpdate.status,
            hostDisplayName: syncUpdate.hostDisplayName,
            sessionCode: syncUpdate.sessionCode,
        });

        if (!record) {
            res.status(202).json({
                ok: true,
                synced: false,
                event: eventName,
                requestId: syncUpdate.requestId,
                reason: 'Portal request not found.',
            });
            return;
        }

        log.info(
            {
                eventName,
                action: syncUpdate.action,
                requestId: record.requestId,
                status: record.status,
            },
            'GitHub webhook synchronized portal request.',
        );

        res.json({
            ok: true,
            synced: true,
            event: eventName,
            action: syncUpdate.action,
            requestId: record.requestId,
            status: record.status,
        });
    } catch (error) {
        const message = error instanceof Error
            ? error.message
            : 'Failed to process GitHub webhook.';

        res.status(400).json({ error: message });
    }
});

app.use(express.json({ limit: JSON_BODY_LIMIT }));

app.post('/api/portal-requests', async (req, res) => {
    try {
        const portalStore = getPortalRequestsStore();
        await portalStore.ready;
        const record = await portalStore.create(req.body ?? {});
        res.setHeader('Cache-Control', 'no-store');
        res.status(201).json(record);
    } catch (error) {
        const message = error instanceof Error
            ? error.message
            : 'Failed to save portal request.';

        res.status(400).json({ error: message });
    }
});

app.get('/api/portal-requests/:requestId', async (req, res) => {
    try {
        const portalStore = getPortalRequestsStore();
        await portalStore.ready;
        const record = await portalStore.get(req.params.requestId || '');

        if (!record) {
            res.status(404).json({ error: 'Portal request not found.' });
            return;
        }

        res.setHeader('Cache-Control', 'no-store');
        res.json(record);
    } catch (error) {
        const message = error instanceof Error
            ? error.message
            : 'Failed to load portal request.';

        res.status(500).json({ error: message });
    }
});

app.patch('/api/portal-requests/:requestId', async (req, res) => {
    try {
        const portalStore = getPortalRequestsStore();
        await portalStore.ready;
        const record = await portalStore.updateStatus(req.params.requestId || '', req.body ?? {});

        if (!record) {
            res.status(404).json({ error: 'Portal request not found.' });
            return;
        }

        res.setHeader('Cache-Control', 'no-store');
        res.json(record);
    } catch (error) {
        const message = error instanceof Error
            ? error.message
            : 'Failed to update portal request.';

        res.status(400).json({ error: message });
    }
});

// --- Static File Serving ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, '..', 'public')));

export async function startServer() {
    const PORT = process.env.PORT || 8080;
    const wsSecret = process.env.WS_SECRET || undefined;
    const allowedOrigins = getAllowedOrigins();

    // Attach Feathers + Socket.io to the HTTP server (no REST transport)
    await createFeathersApp(server, getMongoURI(), allowedOrigins, wsSecret);

    // Start listening
    await new Promise<void>((resolve) => {
        server.listen(PORT, () => {
            log.info({ port: PORT }, `Listening on http://localhost:${PORT}`);
            resolve();
        });
    });

    // Graceful shutdown
    const shutdown = async () => {
        if (server.listening) {
            await new Promise<void>((resolve) => {
                server.close(() => {
                    log.info('Server closed.');
                    resolve();
                });
            });
        }

        const portalStore = portalRequestsStore;
        portalRequestsStore = null;

        if (portalStore) {
            await portalStore.close();
        }
    };

    if (process.env.NODE_ENV !== 'test') {
        const handleSignal = () => {
            void shutdown().finally(() => process.exit(0));
        };

        process.once('SIGINT', handleSignal);
        process.once('SIGTERM', handleSignal);
    }

    return { shutdown };
}

// --- Initialize Server ---
if (process.env.NODE_ENV !== 'test') {
    startServer();
}
