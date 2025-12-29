// Two-bot demo using existing MessagingHub `route` messages.
// Usage:
//   node --loader ts-node/esm scripts/ai-bots.ts
//   WS_URL=ws://host:port node --loader ts-node/esm scripts/ai-bots.ts

import WebSocket from 'ws';

const PORT = process.env.PORT || 8080;
const WS_URL = process.env.WS_URL || `ws://localhost:${PORT}`;
const MAX_TURNS = Number(process.env.BOT_TURNS || 5);
const TURN_DELAY_MS = Number(process.env.BOT_TURN_DELAY_MS || 250);
const END_AFTER_MS = Number(process.env.BOT_TIMEOUT_MS || 10_000);

type Bot = {
    name: string;
    ws: WebSocket;
    id: string | null;
    partnerId: string | null;
    turns: number;
};

function makeBot(name: string): Bot {
    const ws = new WebSocket(WS_URL);
    const bot: Bot = { name, ws, turns: 0, id: null, partnerId: null };

    ws.on('open', () => {
        console.log(`[${name}] connected to ${WS_URL}`);
    });

    ws.on('message', (data) => {
        const msg = safeParse(data.toString());
        if (!msg) return;

        if (msg.type === 'register-success') {
            bot.id = msg.id as string;
            console.log(`[${name}] registered as ${bot.id}`);
            tryStart();
            return;
        }

        if (msg.type === 'message' && msg.from === bot.partnerId) {
            if (bot.turns < MAX_TURNS) {
                bot.turns += 1;
                const reply = `${bot.name} turn ${bot.turns}: replying to '${msg.payload}'`;
                setTimeout(() => sendRoute(bot, reply), TURN_DELAY_MS);
            }
        }
    });

    ws.on('close', () => console.log(`[${name}] closed`));
    ws.on('error', (err) => console.error(`[${name}] error`, err));

    return bot;
}

function safeParse(str: string): any | null {
    try {
        return JSON.parse(str);
    } catch {
        return null;
    }
}

const botA = makeBot('Bot-A');
const botB = makeBot('Bot-B');
let started = false;

function ready(): boolean {
    return Boolean(botA.id && botB.id);
}

function wire() {
    if (!ready()) return;
    botA.partnerId = botB.id;
    botB.partnerId = botA.id;
}

function tryStart() {
    if (started) return;
    wire();
    if (!ready()) return;
    started = true;
    console.log('[bots] Both registered. Starting.');
    sendRoute(botA, 'Hello from Bot-A');
}

function sendRoute(bot: Bot, payload: string) {
    if (!bot.partnerId || bot.ws.readyState !== WebSocket.OPEN) return;
    const message = { type: 'route', to: bot.partnerId, payload };
    bot.ws.send(JSON.stringify(message));
    console.log(`[${bot.name}] -> ${bot.partnerId}: ${payload}`);
}

setTimeout(() => {
    console.log('[bots] Ending session.');
    try { botA.ws.close(); } catch { /* ignore */ }
    try { botB.ws.close(); } catch { /* ignore */ }
    setTimeout(() => process.exit(0), 200);
}, END_AFTER_MS);
