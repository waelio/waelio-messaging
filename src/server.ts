import 'dotenv/config';
import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { MessagingHub } from './MessagingHub.js';

// Use the PORT environment variable provided by Render, with a fallback for local development
const PORT = process.env.PORT || 8080;
const MONGO_URI = process.env.MONGO_URI;

// --- HTTP Server Setup with Express ---
const app = express();
const server = http.createServer(app);

// Parse JSON bodies for API endpoints
app.use(express.json());

// --- Static File Serving ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, '..', 'public')));

/**
 * Initializes the MessagingHub and starts the HTTP server.
 */
async function startServer() {
    // Create an instance of our messaging hub, passing it the server
    // and any configuration options it needs.
    const hub = new MessagingHub(server, { mongoURI: MONGO_URI });
    await hub.ready;

    // Lightweight HTTP API to send messages via POST
    app.post('/api/route', async (req, res) => {
        const { to, payload, from } = req.body || {};
        if (!to || typeof payload === 'undefined') {
            return res.status(400).json({ ok: false, error: 'Missing "to" or "payload"' });
        }
        const ok = await hub.sendToClient(String(to), payload, from ? String(from) : 'api');
        if (!ok) return res.status(404).json({ ok: false, error: 'Recipient not connected' });
        return res.json({ ok: true });
    });

    app.post('/api/broadcast', async (req, res) => {
        const { payload, from, exclude } = req.body || {};
        if (typeof payload === 'undefined') {
            return res.status(400).json({ ok: false, error: 'Missing "payload"' });
        }
        await hub.broadcast(payload, from ? String(from) : 'api', exclude ? String(exclude) : undefined);
        return res.json({ ok: true });
    });

    // Start the HTTP server
    server.listen(PORT, () => {
        console.log(`[Server] HTTP and WebSocket server started on port ${PORT}`);
    });

    // Graceful shutdown
    const shutdown = async () => {
        await hub.shutdown();
        server.close(() => {
            console.log('[Server] HTTP server closed.');
            process.exit(0);
        });
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
}

// --- Initialize Server ---
startServer();
