import { expect } from 'chai';
import request from 'supertest';
import { WebSocket } from 'ws';
import { server, app, startServer } from '../src/server.js';

describe('Messaging App Integration Tests', () => {
    let hub: any;
    const TEST_PORT = 8081;

    before(async () => {
        process.env.PORT = TEST_PORT.toString();
        process.env.NODE_ENV = 'test';
        // Start the server on the test port
        hub = await startServer();
    });

    after(async () => {
        // Cleanup: Close the hub and the underlying HTTP server
        if (hub) await hub.shutdown();
        if (server.listening) {
            await new Promise<void>((resolve) => server.close(() => resolve()));
        }
    });

    describe('REST API', () => {
        it('GET /api/users should return a list of users', async () => {
            const res = await request(app).get('/api/users');
            expect(res.status).to.equal(200);
            expect(res.body).to.have.property('users').that.is.an('array');
        });

        it('POST /api/broadcast should require a payload', async () => {
            const res = await request(app).post('/api/broadcast').send({});
            expect(res.status).to.equal(400);
            expect(res.body.error).to.equal('Missing "payload"');
        });
    });

    describe('WebSocket Real-time Communication', () => {
        it('should assign a clientId upon connection', (done) => {
            const ws = new WebSocket(`ws://localhost:${TEST_PORT}`);
            ws.on('message', (data) => {
                const msg = JSON.parse(data.toString());
                if (msg.type === 'register-success') {
                    expect(msg.id).to.be.a('string');
                    ws.close();
                    done();
                }
            });
        });

        it('should route a direct message between two clients', (done) => {
            const client1 = new WebSocket(`ws://localhost:${TEST_PORT}`);
            const client2 = new WebSocket(`ws://localhost:${TEST_PORT}`);
            let client1Id: string;
            let client2Id: string;
            let readyCount = 0;

            const checkReady = () => {
                readyCount++;
                if (readyCount === 2) {
                    client1.send(JSON.stringify({
                        type: 'route',
                        to: client2Id,
                        payload: 'Hello from client 1'
                    }));
                }
            };

            client1.on('message', (data) => {
                const msg = JSON.parse(data.toString());
                if (msg.type === 'register-success') {
                    client1Id = msg.id;
                    checkReady();
                }
            });

            client2.on('message', (data) => {
                const msg = JSON.parse(data.toString());
                if (msg.type === 'register-success') {
                    client2Id = msg.id;
                    checkReady();
                } else if (msg.type === 'message') {
                    expect(msg.payload).to.equal('Hello from client 1');
                    client1.close(); client2.close(); done();
                }
            });
        });
    });
});
