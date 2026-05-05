import 'dotenv/config';
import express from 'express';
import http from 'http';
import { createLogger } from './logger.js';

const log = createLogger('Server');
import path from 'path';
import { fileURLToPath } from 'url';
import { createFeathersApp } from './feathers/app.js';
import { PortalRequestsStore } from './portalRequestsStore.js';

const MONGO_URI = process.env.MONGO_URI;
const WS_SECRET = process.env.WS_SECRET || undefined;
const portalRequestsStore = new PortalRequestsStore(MONGO_URI);

// Comma-separated list of allowed origins, e.g. "https://waelio-messaging.netlify.app"
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

// --- HTTP Server Setup with Express (static files only) ---
const app = express();
const server = http.createServer(app);

export { app, server };

app.use(express.json({ limit: '256kb' }));

const isAllowedOrigin = (origin: string): boolean =>
    !origin || ALLOWED_ORIGINS.length === 0 || ALLOWED_ORIGINS.includes(origin);

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

app.post('/api/portal-requests', async (req, res) => {
    try {
        await portalRequestsStore.ready;
        const record = await portalRequestsStore.create(req.body ?? {});
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
        await portalRequestsStore.ready;
        const record = await portalRequestsStore.get(req.params.requestId || '');

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
        await portalRequestsStore.ready;
        const record = await portalRequestsStore.updateStatus(req.params.requestId || '', req.body ?? {});

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

    // Attach Feathers + Socket.io to the HTTP server (no REST transport)
    await createFeathersApp(server, MONGO_URI, ALLOWED_ORIGINS, WS_SECRET);

    // Start listening
    await new Promise<void>((resolve) => {
        server.listen(PORT, () => {
            log.info({ port: PORT }, `Listening on http://localhost:${PORT}`);
            resolve();
        });
    });

    // Graceful shutdown
    const shutdown = () => {
        server.close(() => {
            log.info('Server closed.');
            if (process.env.NODE_ENV !== 'test') process.exit(0);
        });

        void portalRequestsStore.close();
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
}

// --- Initialize Server ---
if (process.env.NODE_ENV !== 'test') {
    startServer();
}
