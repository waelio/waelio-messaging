import { expect } from 'chai';
import { WebSocket } from 'ws';
import http from 'http';
import express from 'express';
import { AddressInfo } from 'net';
import 'dotenv/config';
import { MongoClient } from 'mongodb';
import { MessagingHub } from '../src/MessagingHub.js';

describe('Messaging Server', () => {
    let server: http.Server;
    let hub: MessagingHub;
    let port: number;

    before(async () => {
        const app = express();
        app.use(express.json());
        server = http.createServer(app);

        // Use in-memory mode (no mongoURI) for fast, isolated tests
        hub = new MessagingHub(server);
        await hub.ready;

        app.get('/api/users', (_req, res) => {
            const users = hub.getConnectedUsers ? hub.getConnectedUsers() : [];
            res.json({ users });
        });

        await new Promise<void>((resolve) => server.listen(0, resolve));
        port = (server.address() as AddressInfo).port;
    });

    after(async () => {
        if (hub) await hub.shutdown();
        if (server?.listening) {
            await new Promise<void>((resolve) => server.close(() => resolve()));
        }
    });

    it('should allow a client to connect and receive a registration success message', (done) => {
        const ws = new WebSocket(`ws://localhost:${port}`);
        let receivedRegisterSuccess = false;

        ws.on('message', (data) => {
            const message = JSON.parse(data.toString());
            if (message.type === 'register-success') {
                expect(message.id).to.be.a('string');
                receivedRegisterSuccess = true;
            } else if (message.type === 'user-list' && receivedRegisterSuccess) {
                ws.close();
                done();
            }
        });

        ws.on('error', done);
    });

    it('should connect to MongoDB if MONGO_URI is set', function (done) {
        this.timeout(6000);
        const mongoUri = process.env.MONGO_URI;
        if (!mongoUri) {
            this.skip();
            return;
        }
        const client = new MongoClient(mongoUri, { serverSelectionTimeoutMS: 2000 });
        client.connect()
            .then(() => client.close())
            .then(() => done())
            .catch((err) => done(err));
    });
});