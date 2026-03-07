# waelio-messaging

[![npm version](https://img.shields.io/npm/v/%40waelio%2Fmessaging?logo=npm)](https://www.npmjs.com/package/@waelio/messaging)
[![npm downloads](https://img.shields.io/npm/dm/%40waelio%2Fmessaging?logo=npm)](https://www.npmjs.com/package/@waelio/messaging)
[![CI](https://github.com/waelio/waelio-messaging/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/waelio/waelio-messaging/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Minimal real-time WebSocket messaging hub: direct, broadcast, user list, history, optional Mongo persistence, typed API.

Live Demo: https://waelio-messaging.onrender.com/

## What is this?

`waelio-messaging` gives you:

- a WebSocket messaging server
- a ready-to-use chat UI (`public/index.html`)
- direct message + broadcast + message history
- optional MongoDB persistence

If you just want to run and chat locally, use the 5-minute guide below.

## 5-minute start (recommended)

### 1) Install dependencies

```bash
npm install
```

### 2) Start the app

```bash
npm run dev
```

### 3) Open the app

Open your browser at:

- http://localhost:8080

### 4) Test chat quickly

Open **2 browser tabs** to the same URL and:

- send a direct message
- click **Broadcast** for all users
- click **History** to load previous messages

## How to use the UI

- **Users Online** (left): pick a user for direct messages
- **Send**: sends to selected user
- **Broadcast**: sends to everyone
- **History**: loads saved/in-memory message history
- **Room Start/Leave**: optional focused room messaging
- **Install** (when shown): install the PWA

## Background activity indicators

When the tab is in background and a new message arrives, the app shows:

- unread count in the tab title
- a favicon badge
- pulsing activity dot + count in the header

The indicator clears when you return to the tab/window.

## PWA (Installable Client)

The bundled UI under `public/` is a Progressive Web App:

- Installable on desktop and mobile (manifest + service worker)
- Basic offline support (core assets cached, navigation fallback)
- Install prompt via `beforeinstallprompt`

## Troubleshooting

### App doesn’t open

- Ensure server is running (`npm run dev`)
- Ensure port `8080` is free

### No messages between tabs

- Make sure both tabs use the same server URL
- Hard refresh both tabs after restarting server

### MongoDB persistence not working

- Set `MONGO_URI` to a valid Mongo connection string
- Without `MONGO_URI`, app uses in-memory storage by design

## Package install

If you want to use this as a library in your own project:

```bash
npm install @waelio/messaging
```

## Library usage (server)

```bash
npm run dev       # start in dev (ts-node)
npm run build     # compile TypeScript
npm start         # run compiled server
```

### Web APIs used (client activity indicators)

- Page Visibility API (`document.hidden`, `visibilitychange`)
- Window focus event (`window.addEventListener('focus', ...)`)
- Document title updates (`document.title`)
- Favicon updates via `<link rel="icon">` + Canvas API
- PWA install events (`beforeinstallprompt`, `appinstalled`)

## Advanced: create your own server

```ts
import http from "http";
import express from "express";
import { MessagingHub } from "@waelio/messaging";

const app = express();
const server = http.createServer(app);

// Optional: { mongoURI: 'mongodb+srv://...' }
const hub = new MessagingHub(server);

server.listen(8080, () => console.log("ready"));
```

## Web Component

Auto-send on connect:

```html
<waelio-message target="USER_ID" message="hello"></waelio-message>
```

Broadcast:

```html
<waelio-message message="hello everyone" broadcast></waelio-message>
```

Manual:

```html
<waelio-message id="msg" send-on="manual" target="USER_ID"></waelio-message>
<script>
  msg.addEventListener("connected", () => msg.send("hi again"));
</script>
```

Attributes: target, message, broadcast, ws-url, send-on (connect|manual|click), reconnect.
Events: connected, disconnected, sent, error.

## Protocol (Summary)

Client → Server:

- `route` { to, payload }
- `broadcast` { payload }
- `get-history` {}
- typing: `start-typing` / `stop-typing`
- room: `join-room` { with }, `room-message` { payload }

Server → Client:

- `register-success` { id }
- `user-list` { users[] }
- `message` { from, payload, isBroadcast? }
- `message-history` { history[] }
- `user-typing` { id } / `user-stopped-typing` { id }
- `joined-room` { roomId, with }
- `partner-left-room` { roomId }
- `user-joined` { id, ts }
- `user-left` { id, ts }
- `error` { message }

## Persistence (Optional)

Provide `mongoURI` to keep more than in-memory history & survive restarts.

```ts
new MessagingHub(server, { mongoURI: process.env.MONGO_URI });
```

## Release Scripts

Patch / Minor / Major then publish:

```bash
npm run release:patch && npm run release:publish
npm run release:minor && npm run release:publish
npm run release:major && npm run release:publish
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
