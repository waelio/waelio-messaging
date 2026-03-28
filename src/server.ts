import 'dotenv/config';
import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { createFeathersApp } from './feathers/app.js';

const MONGO_URI = process.env.MONGO_URI;

// Comma-separated list of allowed origins, e.g. "https://waelio-messaging.netlify.app"
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

// --- HTTP Server Setup with Express (static files only) ---
const app = express();
const server = http.createServer(app);

export { app, server };

// CORS for HTTP polling leg of Socket.io
app.use((req, res, next) => {
    const origin = req.headers.origin || '';
    if (ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    }
    if (req.method === 'OPTIONS') { res.sendStatus(204); return; }
    next();
});

// --- Static File Serving ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, '..', 'public')));

export async function startServer() {
    const PORT = process.env.PORT || 8080;

    // Attach Feathers + Socket.io to the HTTP server (no REST transport)
    await createFeathersApp(server, MONGO_URI, ALLOWED_ORIGINS);

    // Start listening
    await new Promise<void>((resolve) => {
        server.listen(PORT, () => {
            console.log(`[Server] Listening on http://localhost:${PORT}`);
            resolve();
        });
    });

    // Graceful shutdown
    const shutdown = () => {
        server.close(() => {
            console.log('[Server] Closed.');
            if (process.env.NODE_ENV !== 'test') process.exit(0);
        });
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
}

// --- Initialize Server ---
if (process.env.NODE_ENV !== 'test') {
    startServer();
}
