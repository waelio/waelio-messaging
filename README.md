# waelio-messaging

[![npm version](https://img.shields.io/npm/v/%40waelio%2Fmessaging?logo=npm)](https://www.npmjs.com/package/@waelio/messaging)
[![npm downloads](https://img.shields.io/npm/dm/%40waelio%2Fmessaging?logo=npm)](https://www.npmjs.com/package/@waelio/messaging)
[![CI](https://github.com/waelio/waelio-messaging/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/waelio/waelio-messaging/actions/workflows/ci.yml)
[![license](https://img.shields.io/github/license/waelio/waelio-messaging)](LICENSE)

Minimal real-time WebSocket messaging hub: direct, broadcast, user list, history, optional Mongo persistence, typed API.

Live Demo: https://waelio-messaging.onrender.com/

## Install

```bash
npm install @waelio/messaging
```

## Quick Start (Server)

```bash
npm run dev       # start in dev (ts-node)
npm run build     # compile TypeScript
npm start         # run compiled server
```

## PWA (Installable Client)

The bundled UI under `public/` is a Progressive Web App:

- Installable on desktop and mobile (manifest + service worker)
- Basic offline support (core assets cached, navigation fallback)
- “Install” button appears when eligible (uses `beforeinstallprompt`)

Try it on the Live Demo or locally after:

```bash
npm run build
npm start
```

If your browser doesn’t show the install prompt automatically, use the “Install” button in the top bar (it’s only visible when installable per browser policy).

## Library Usage

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

MIT License

Copyright (c) 2025 Waelio

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

See LICENSE file for the authoritative text.
