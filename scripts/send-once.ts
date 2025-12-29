// One-shot sender: connect, register, send a route message to TARGET_ID, exit.
// Usage:
//   TARGET_ID=<id> PAYLOAD="Hello" node --loader ts-node/esm scripts/send-once.ts
//   WS_URL=ws://host:port TARGET_ID=<id> PAYLOAD="Hi" node --loader ts-node/esm scripts/send-once.ts

import WebSocket from 'ws';

const PORT = process.env.PORT || 8080;
const WS_URL = process.env.WS_URL || `ws://localhost:${PORT}`;
const TARGET_ID = process.env.TARGET_ID;
const PAYLOAD = process.env.PAYLOAD || 'Hello from send-once';

if (!TARGET_ID) {
    console.error('Missing TARGET_ID env var. Example: TARGET_ID=abc PAYLOAD="Hi" node --loader ts-node/esm scripts/send-once.ts');
    process.exit(1);
}

const ws = new WebSocket(WS_URL);

ws.on('open', () => {
    console.log(`[sender] connected to ${WS_URL}`);
});

ws.on('message', (data) => {
    const msg = safeParse(data.toString());
    if (!msg) return;
    if (msg.type === 'register-success') {
        const myId = msg.id as string;
        console.log(`[sender] registered as ${myId}; sending to ${TARGET_ID}`);
        const out = { type: 'route', to: TARGET_ID, payload: PAYLOAD };
        ws.send(JSON.stringify(out));
        console.log('[sender] sent payload. Exiting.');
        setTimeout(() => ws.close(), 200);
    }
});

ws.on('close', () => {
    console.log('[sender] closed');
    setTimeout(() => process.exit(0), 50);
});

ws.on('error', (err) => {
    console.error('[sender] error', err);
});

function safeParse(str: string): any | null {
    try { return JSON.parse(str); } catch { return null; }
}
