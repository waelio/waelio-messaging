import type { Server as HttpServer } from 'http';
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
export declare function createFeathersApp(httpServer: HttpServer, mongoURI?: string): Promise<import("@feathersjs/feathers").Application<any, any>>;
