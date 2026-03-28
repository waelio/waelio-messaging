import 'dotenv/config';
import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { createFeathersApp } from './feathers/app.js';

const MONGO_URI = process.env.MONGO_URI;

// --- HTTP Server Setup with Express (static files only) ---
const app = express();
const server = http.createServer(app);

export { app, server };

// --- Static File Serving ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, '..', 'public')));

export async function startServer() {
    const PORT = process.env.PORT || 8080;

    // Attach Feathers + Socket.io to the HTTP server (no REST transport)
    await createFeathersApp(server, MONGO_URI);

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
