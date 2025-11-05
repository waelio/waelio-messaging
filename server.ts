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
