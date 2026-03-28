import { feathers } from '@feathersjs/feathers';
import socketio from '@feathersjs/socketio';
import type { Server as HttpServer } from 'http';
import { configureChannels } from './channels.js';
import { MessagesService } from './services/messages.js';
import { RoomsService } from './services/rooms.js';

/**
 * Creates and configures a Feathers application using Socket.io only (no REST).
 *
 * Transport mapping vs the old MessagingHub:
 *   Old ws message type  →  Feathers service call (from client)
 *   ─────────────────────────────────────────────────────────────
 *   route                →  messages::create  { type:'route', to, payload }
 *   broadcast            →  messages::create  { type:'broadcast', payload }
 *   get-history          →  messages::find    {}
 *   join-room            →  rooms::create     { with: partnerId }
 *   room-message         →  messages::create  { type:'room-message', payload }
 *   start-typing         →  socket.emit('start-typing')  (raw socket event)
 *   stop-typing          →  socket.emit('stop-typing')   (raw socket event)
 *
 * Outgoing events (server → client):
 *   'register-success'   →  socket event on connect  { id }
 *   'user-list'          →  socket event             { users }
 *   'user-joined'        →  socket event             { id, ts }
 *   'user-left'          →  socket event             { id, ts }
 *   'user-typing'        →  socket event             { id }
 *   'user-stopped-typing'→  socket event             { id }
 *   'messages created'   →  Feathers service event   (message object)
 *   'rooms created'      →  Feathers service event   { roomId, userId, partnerId }
 */
export async function createFeathersApp(httpServer: HttpServer, mongoURI?: string) {
    const messagesService = new MessagesService(mongoURI);
    await messagesService.ready;

    const app = feathers();

    // ── Real-time only: Socket.io transport, no REST ─────────────────────────
    app.configure(
        socketio((io) => {
            // Socket middleware: runs before 'connection' event handlers.
            // Sets clientId on socket.feathers so channels.ts can read it.
            io.use((socket, next) => {
                (socket as any).feathers = (socket as any).feathers ?? {};
                (socket as any).feathers.clientId = socket.id;
                next();
            });

            io.on('connection', (socket) => {
                const clientId: string = socket.id;

                // Tell the client its assigned ID
                socket.emit('register-success', { id: clientId });

                // Broadcast updated user list to all clients
                const broadcastUserList = () => {
                    const users = (app as any)
                        .channel('all')
                        .connections.map((c: any) => c.clientId);
                    io.emit('user-list', { users });
                };
                broadcastUserList();
                io.emit('user-joined', { id: clientId, ts: Date.now() });

                // Ephemeral typing indicators — not persisted, not routed via channels
                socket.on('start-typing', () =>
                    socket.broadcast.emit('user-typing', { id: clientId })
                );
                socket.on('stop-typing', () =>
                    socket.broadcast.emit('user-stopped-typing', { id: clientId })
                );

                socket.on('disconnect', () => {
                    io.emit('user-left', { id: clientId, ts: Date.now() });
                    // Channels drop the connection automatically; update the list
                    setImmediate(broadcastUserList);
                });
            });
        })
    );

    // ── Services ─────────────────────────────────────────────────────────────
    app.use('messages', messagesService);
    app.use('rooms', new RoomsService(app));

    // ── Channels ─────────────────────────────────────────────────────────────
    // Declarative routing: replaces _broadcastToOthers / _broadcastClientList
    app.configure(configureChannels);

    // ── Attach to existing HTTP server ───────────────────────────────────────
    await app.setup(httpServer);

    console.log('[Feathers] Socket.io app ready (no REST)');
    return app;
}
