import { expect } from 'chai';
import { WebSocket } from 'ws';
import { exec, spawn, ChildProcess, ChildProcessWithoutNullStreams } from 'child_process';
import net from 'net';
import 'dotenv/config';
import { MongoClient } from 'mongodb';

// The server runs on a dedicated test port to avoid conflicts with local services.
const testPort = Number(process.env.TEST_PORT || '8090');
const wsUrl = `ws://localhost:${testPort}`;
const runIntegration = process.env.RUN_INTEGRATION === 'true';

(runIntegration ? describe : describe.skip)('Messaging Server', () => {
    let serverProcess: ChildProcess;

    // Try IPv6 and IPv4 loopbacks by using 'localhost' to avoid family mismatch issues
    const waitForPort = (port: number, host = 'localhost', deadlineMs = 20000, intervalMs = 250) => {
        const start = Date.now();
        return new Promise<void>((resolve, reject) => {
            const tryOnce = () => {
                // Try both IPv6 and IPv4 in parallel; resolve if either connects
                let settled = false;
                const done = (ok: boolean) => {
                    if (settled) return;
                    settled = true;
                    if (ok) resolve(); else retry();
                };

                const attempt = (h: string) => {
                    const socket = new net.Socket();
                    socket.setTimeout(intervalMs);
                    socket.once('connect', () => { socket.destroy(); done(true); });
                    const fail = () => { socket.destroy(); done(false); };
                    socket.once('timeout', fail);
                    socket.once('error', fail);
                    socket.connect(port, h);
                };

                attempt('::1');
                attempt('127.0.0.1');
            };
            const retry = () => {
                if (Date.now() - start >= deadlineMs) {
                    reject(new Error(`Port ${host}:${port} did not open in time`));
                } else {
                    setTimeout(tryOnce, intervalMs);
                }
            };
            tryOnce();
        });
    };

    // Before all tests, start the server
    before(async function () {
        this.timeout(30000);
        console.log(`Starting server for tests on port ${testPort}...`);
        // Prefer running the compiled server for speed; if it fails to start, fall back to ts-node
        // Force in-memory mode for the server during tests to avoid external Mongo connections from .env
        const env = { ...process.env, PORT: String(testPort), MONGO_URI: '' };
        const startDist = () => spawn('node', ['dist/server.js'], { env }) as unknown as ChildProcessWithoutNullStreams;
        const startTs = () => spawn('node', ['--loader', 'ts-node/esm', 'src/server.ts'], { env }) as unknown as ChildProcessWithoutNullStreams;

        const attachLogs = (cp: ChildProcessWithoutNullStreams) => {
            cp.stdout.on('data', (chunk) => process.stdout.write(chunk.toString()));
            cp.stderr.on('data', (chunk) => process.stderr.write(chunk.toString()));
            cp.on('exit', (code, signal) => {
                console.error(`[Test] Server process exited with code=${code} signal=${signal}`);
            });
        };

        // Try compiled build first, then fall back to ts-node
        serverProcess = startDist();
        attachLogs(serverProcess as ChildProcessWithoutNullStreams);
        try {
            await waitForPort(testPort, 'localhost', 20000, 300);
        } catch (e) {
            console.warn('[Test] Compiled server did not open port in time. Falling back to ts-node...');
            (serverProcess as ChildProcessWithoutNullStreams).kill('SIGINT');
            serverProcess = startTs();
            attachLogs(serverProcess as ChildProcessWithoutNullStreams);
            await waitForPort(testPort, 'localhost', 20000, 300);
        }
    });

    // After all tests, stop the server
    after(() => {
        console.log('Stopping server...');
        if (serverProcess) {
            serverProcess.kill('SIGINT');
        }
    });

    it('should allow a client to connect and receive a registration success message', (done) => {
        const ws = new WebSocket(wsUrl);
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
        const runMongo = process.env.RUN_MONGO_TESTS === 'true';
        if (!runMongo || !mongoUri) {
            // Skip unless explicitly enabled and URI provided
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