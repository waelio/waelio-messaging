import 'mocha';
import { expect } from 'chai';
import http from 'http';
import { AddressInfo } from 'net';
import { MessagingHub } from '../src/MessagingHub.js';
import { WebSocket } from 'ws';

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Connect and resolve with { ws, id } once register-success arrives. */
function connect(port: number): Promise<{ ws: WebSocket; id: string }> {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(`ws://localhost:${port}`);
        ws.on('error', reject);
        ws.on('message', (data) => {
            const msg = JSON.parse(data.toString());
            if (msg.type === 'register-success') resolve({ ws, id: msg.id as string });
        });
    });
}

/** Resolves with the first message matching predicate, rejects after 2 s. */
function nextMessage(ws: WebSocket, predicate: (m: any) => boolean): Promise<any> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Timed out waiting for message')), 2000);
        const handler = (data: any) => {
            const msg = JSON.parse(data.toString());
            if (predicate(msg)) {
                clearTimeout(timer);
                ws.off('message', handler);
                resolve(msg);
            }
        };
        ws.on('message', handler);
    });
}

/** Spin up an isolated server+hub, run fn, then tear down. */
async function withSecureHub(
    secret: string,
    fn: (port: number, hub: MessagingHub, srv: http.Server) => Promise<void>,
): Promise<void> {
    const srv = http.createServer();
    await new Promise<void>(r => srv.listen(0, r));
    const p = (srv.address() as AddressInfo).port;
    const h = new MessagingHub(srv, { secret });
    await h.ready;
    try {
        await fn(p, h, srv);
    } finally {
        await h.shutdown();
        await new Promise<void>(r => srv.close(() => r()));
    }
}

// ── Suite ────────────────────────────────────────────────────────────────────

describe('MessagingHub', () => {
    let server: http.Server;
    let hub: MessagingHub;
    let port: number;

    beforeEach(async () => {
        server = http.createServer();
        await new Promise<void>(resolve => server.listen(0, resolve));
        port = (server.address() as AddressInfo).port;
        hub = new MessagingHub(server);
        await hub.ready;
    });

    afterEach(async () => {
        if (hub) await hub.shutdown();
        if (server?.listening) await new Promise<void>(r => server.close(() => r()));
    });

    // ── Connection ────────────────────────────────────────────────────────────

    it('instantiates without errors', () => {
        expect(hub).to.be.an.instanceOf(MessagingHub);
    });

    it('assigns a unique ID on connection', async () => {
        const { ws, id } = await connect(port);
        expect(id).to.be.a('string').with.length.greaterThan(0);
        ws.close();
    });

    it('broadcasts user-list to all clients on connect', async () => {
        const a = await connect(port);
        // B's handler is attached before the WS handshake completes,
        // so we are guaranteed to receive both register-success and user-list in order.
        await new Promise<void>((resolve, reject) => {
            const ws = new WebSocket(`ws://localhost:${port}`);
            const timer = setTimeout(() => reject(new Error('Timed out waiting for user-list')), 2000);
            let bId: string;
            ws.on('error', reject);
            ws.on('message', (data) => {
                const msg = JSON.parse(data.toString());
                if (msg.type === 'register-success') bId = msg.id as string;
                if (msg.type === 'user-list' && bId) {
                    clearTimeout(timer);
                    try {
                        expect(msg.users).to.include(a.id);
                        expect(msg.users).to.include(bId);
                        ws.close();
                        resolve();
                    } catch (e) { reject(e); }
                }
            });
        });
        a.ws.close();
    });

    it('notifies existing clients of new connection (user-joined)', async () => {
        const a = await connect(port);
        const joined = nextMessage(a.ws, m => m.type === 'user-joined');
        const b = await connect(port);
        const msg = await joined;
        expect(msg.id).to.equal(b.id);
        a.ws.close();
        b.ws.close();
    });

    // ── route ─────────────────────────────────────────────────────────────────

    describe('route', () => {
        it('delivers a direct message to the recipient', async () => {
            const [a, b] = await Promise.all([connect(port), connect(port)]);
            const incoming = nextMessage(b.ws, m => m.type === 'message' && !m.isBroadcast);
            a.ws.send(JSON.stringify({ type: 'route', to: b.id, payload: 'hello' }));
            const msg = await incoming;
            expect(msg.from).to.equal(a.id);
            expect(msg.payload).to.equal('hello');
            a.ws.close(); b.ws.close();
        });

        it('returns error when recipient is unknown', async () => {
            const { ws } = await connect(port);
            const incoming = nextMessage(ws, m => m.type === 'error');
            ws.send(JSON.stringify({ type: 'route', to: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', payload: 'hi' }));
            const msg = await incoming;
            expect(msg.message).to.include('not found');
            ws.close();
        });
    });

    // ── broadcast ─────────────────────────────────────────────────────────────

    describe('broadcast', () => {
        it('delivers to all other connected clients', async () => {
            const [a, b, c] = await Promise.all([connect(port), connect(port), connect(port)]);
            const bIncoming = nextMessage(b.ws, m => m.type === 'message' && m.isBroadcast);
            const cIncoming = nextMessage(c.ws, m => m.type === 'message' && m.isBroadcast);
            a.ws.send(JSON.stringify({ type: 'broadcast', payload: 'hello all' }));
            const [bMsg, cMsg] = await Promise.all([bIncoming, cIncoming]);
            expect(bMsg.payload).to.equal('hello all');
            expect(cMsg.payload).to.equal('hello all');
            [a, b, c].forEach(cl => cl.ws.close());
        });

        it('does not echo broadcast back to the sender', async () => {
            const [a, b] = await Promise.all([connect(port), connect(port)]);
            let senderReceived = false;
            a.ws.on('message', (data) => {
                const m = JSON.parse(data.toString());
                if (m.type === 'message' && m.isBroadcast) senderReceived = true;
            });
            a.ws.send(JSON.stringify({ type: 'broadcast', payload: 'echo-check' }));
            // Wait until b receives it — proves the broadcast was sent
            await nextMessage(b.ws, m => m.type === 'message' && m.isBroadcast);
            expect(senderReceived).to.be.false;
            [a, b].forEach(cl => cl.ws.close());
        });
    });

    // ── get-history ───────────────────────────────────────────────────────────

    describe('get-history', () => {
        it('returns a message-history array', async () => {
            const { ws } = await connect(port);
            const incoming = nextMessage(ws, m => m.type === 'message-history');
            ws.send(JSON.stringify({ type: 'get-history' }));
            const msg = await incoming;
            expect(msg.history).to.be.an('array');
            ws.close();
        });

        it('includes previously persisted broadcast messages', async () => {
            const [a, b] = await Promise.all([connect(port), connect(port)]);
            a.ws.send(JSON.stringify({ type: 'broadcast', payload: 'history-marker' }));
            // Wait until b receives it so the message is in the store
            await nextMessage(b.ws, m => m.type === 'message' && m.isBroadcast);

            const incoming = nextMessage(a.ws, m => m.type === 'message-history');
            a.ws.send(JSON.stringify({ type: 'get-history' }));
            const msg = await incoming;
            const found = (msg.history as any[]).some(h => h.payload === 'history-marker');
            expect(found).to.be.true;
            [a, b].forEach(cl => cl.ws.close());
        });
    });

    // ── join-room + room-message ───────────────────────────────────────────────

    describe('join-room', () => {
        it('creates a shared room and notifies both participants', async () => {
            const [a, b] = await Promise.all([connect(port), connect(port)]);
            const aJoined = nextMessage(a.ws, m => m.type === 'joined-room');
            const bJoined = nextMessage(b.ws, m => m.type === 'joined-room');
            a.ws.send(JSON.stringify({ type: 'join-room', with: b.id }));
            const [aMsg, bMsg] = await Promise.all([aJoined, bJoined]);
            expect(aMsg.roomId).to.be.a('string');
            expect(bMsg.roomId).to.equal(aMsg.roomId);
            expect(aMsg.with).to.equal(b.id);
            expect(bMsg.with).to.equal(a.id);
            [a, b].forEach(cl => cl.ws.close());
        });

        it('returns error when joining with self', async () => {
            const { ws, id } = await connect(port);
            const incoming = nextMessage(ws, m => m.type === 'error');
            ws.send(JSON.stringify({ type: 'join-room', with: id }));
            const msg = await incoming;
            expect(msg.message).to.include('Invalid');
            ws.close();
        });

        it('returns error when partner is not online', async () => {
            const { ws } = await connect(port);
            const incoming = nextMessage(ws, m => m.type === 'error');
            ws.send(JSON.stringify({ type: 'join-room', with: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' }));
            const msg = await incoming;
            expect(msg.message).to.include('not online');
            ws.close();
        });
    });

    describe('room-message', () => {
        it('delivers only to the room partner, not to third parties', async () => {
            const [a, b, c] = await Promise.all([connect(port), connect(port), connect(port)]);
            const aJoined = nextMessage(a.ws, m => m.type === 'joined-room');
            const bJoined = nextMessage(b.ws, m => m.type === 'joined-room');
            a.ws.send(JSON.stringify({ type: 'join-room', with: b.id }));
            await Promise.all([aJoined, bJoined]);

            let cReceived = false;
            c.ws.on('message', (data) => {
                const m = JSON.parse(data.toString());
                if (m.type === 'message' && m.roomId) cReceived = true;
            });

            const bIncoming = nextMessage(b.ws, m => m.type === 'message' && m.roomId);
            a.ws.send(JSON.stringify({ type: 'room-message', payload: 'private' }));
            const msg = await bIncoming;
            expect(msg.payload).to.equal('private');
            expect(msg.from).to.equal(a.id);
            expect(cReceived).to.be.false;
            [a, b, c].forEach(cl => cl.ws.close());
        });

        it('returns error when sender is not in a room', async () => {
            const { ws } = await connect(port);
            const incoming = nextMessage(ws, m => m.type === 'error');
            ws.send(JSON.stringify({ type: 'room-message', payload: 'oops' }));
            const msg = await incoming;
            expect(msg.message).to.include('not in a room');
            ws.close();
        });
    });

    // ── typing indicators ─────────────────────────────────────────────────────

    describe('typing indicators', () => {
        it('broadcasts user-typing to other clients', async () => {
            const [a, b] = await Promise.all([connect(port), connect(port)]);
            const typing = nextMessage(b.ws, m => m.type === 'user-typing' && m.id === a.id);
            a.ws.send(JSON.stringify({ type: 'start-typing' }));
            await typing;
            [a, b].forEach(cl => cl.ws.close());
        });

        it('broadcasts user-stopped-typing to other clients', async () => {
            const [a, b] = await Promise.all([connect(port), connect(port)]);
            const stopped = nextMessage(b.ws, m => m.type === 'user-stopped-typing' && m.id === a.id);
            a.ws.send(JSON.stringify({ type: 'stop-typing' }));
            await stopped;
            [a, b].forEach(cl => cl.ws.close());
        });
    });

    // ── disconnect ────────────────────────────────────────────────────────────

    describe('disconnect', () => {
        it('notifies remaining clients with user-left', async () => {
            const [a, b] = await Promise.all([connect(port), connect(port)]);
            const userLeft = nextMessage(b.ws, m => m.type === 'user-left' && m.id === a.id);
            a.ws.close();
            const msg = await userLeft;
            expect(msg.id).to.equal(a.id);
            b.ws.close();
        });

        it('notifies room partner with partner-left-room', async () => {
            const [a, b] = await Promise.all([connect(port), connect(port)]);
            const aJoined = nextMessage(a.ws, m => m.type === 'joined-room');
            const bJoined = nextMessage(b.ws, m => m.type === 'joined-room');
            a.ws.send(JSON.stringify({ type: 'join-room', with: b.id }));
            await Promise.all([aJoined, bJoined]);

            const partnerLeft = nextMessage(b.ws, m => m.type === 'partner-left-room');
            a.ws.close();
            await partnerLeft;
            b.ws.close();
        });

        it('removes disconnected client from user-list', async () => {
            const [a, b] = await Promise.all([connect(port), connect(port)]);
            const listUpdate = nextMessage(b.ws, m => m.type === 'user-list' && !(m.users as string[]).includes(a.id));
            a.ws.close();
            const msg = await listUpdate;
            expect(msg.users).to.not.include(a.id);
            b.ws.close();
        });
    });

    // ── error handling ────────────────────────────────────────────────────────

    describe('error handling', () => {
        it('returns error for malformed JSON', async () => {
            const { ws } = await connect(port);
            const incoming = nextMessage(ws, m => m.type === 'error');
            ws.send('not-valid-json{{{');
            const msg = await incoming;
            expect(msg.message).to.include('Invalid JSON');
            ws.close();
        });

        it('returns error for unknown message type', async () => {
            const { ws } = await connect(port);
            const incoming = nextMessage(ws, m => m.type === 'error');
            ws.send(JSON.stringify({ type: 'no-such-type' }));
            const msg = await incoming;
            expect(msg.message).to.include('Invalid message format');
            ws.close();
        });

        it('returns error for payload exceeding 64 KB', async () => {
            const { ws } = await connect(port);
            const incoming = nextMessage(ws, m => m.type === 'error');
            ws.send(JSON.stringify({ type: 'broadcast', payload: 'x'.repeat(65 * 1024) }));
            const msg = await incoming;
            expect(msg.message).to.include('Invalid message format');
            ws.close();
        });

        it('returns error for missing required field (route without to)', async () => {
            const { ws } = await connect(port);
            const incoming = nextMessage(ws, m => m.type === 'error');
            ws.send(JSON.stringify({ type: 'route', payload: 'hi' }));
            const msg = await incoming;
            expect(msg.message).to.include('Invalid message format');
            ws.close();
        });
    });

    // ── rate limiting ─────────────────────────────────────────────────────────

    describe('rate limiting', () => {
        it('rejects messages after exceeding 30 per 10 s window', async () => {
            const { ws } = await connect(port);
            const errors: any[] = [];
            ws.on('message', (data) => {
                const m = JSON.parse(data.toString());
                if (m.type === 'error' && (m.message as string).includes('Rate limit')) errors.push(m);
            });
            for (let i = 0; i < 35; i++) {
                ws.send(JSON.stringify({ type: 'broadcast', payload: `msg ${i}` }));
            }
            await new Promise<void>(r => setTimeout(r, 300));
            expect(errors.length).to.be.greaterThan(0);
            ws.close();
        });
    });

    // ── WS secret auth ────────────────────────────────────────────────────────

    describe('secret authentication', () => {
        it('rejects connection with wrong token', async () => {
            await withSecureHub('correct-secret', async (p) => {
                await new Promise<void>((resolve, reject) => {
                    const ws = new WebSocket(`ws://localhost:${p}?token=wrong`);
                    ws.on('error', resolve);         // error = rejected = expected
                    ws.on('open', () => reject(new Error('Should not have connected')));
                });
            });
        });

        it('accepts connection with correct token', async () => {
            await withSecureHub('correct-secret', async (p) => {
                await new Promise<void>((resolve, reject) => {
                    const ws = new WebSocket(`ws://localhost:${p}?token=correct-secret`);
                    ws.on('error', reject);
                    ws.on('message', (data) => {
                        const msg = JSON.parse(data.toString());
                        if (msg.type === 'register-success') { ws.close(); resolve(); }
                    });
                });
            });
        });
    });
});