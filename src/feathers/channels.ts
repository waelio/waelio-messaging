import type { RealTimeConnection } from '@feathersjs/feathers';

/**
 * Feathers channels configuration.
 *
 * Replaces the manual broadcast loops in MessagingHub with declarative
 * channel-based routing:
 *   - 'all'              → every connected socket
 *   - 'direct/<id>'      → a single client's personal channel (for direct routing)
 *   - 'rooms/<roomId>'   → private two-person room channel
 *
 * service.publish() decides *which* channel(s) receive each service event,
 * eliminating the need for _broadcastToOthers / _broadcastClientList loops.
 */
export function configureChannels(app: any): void {
    if (typeof app.channel !== 'function') {
        // No real-time transport configured — skip
        return;
    }

    // On connect: join the global channel and a personal direct channel
    app.on('connection', (connection: RealTimeConnection) => {
        app.channel('all').join(connection);

        const clientId = (connection as any).clientId;
        if (clientId) {
            app.channel(`direct/${clientId}`).join(connection);
        }
    });

    // On disconnect: Feathers automatically removes the connection from all channels.

    // ── Messages service publishing rules ────────────────────────────────────
    // The publish callback returns the channel(s) that should receive the event.
    // Returning null suppresses the event entirely.
    app.service('messages').publish((data: any, _context: any) => {
        const { type, senderId, recipientId, roomId } = data;

        if (type === 'route' && recipientId) {
            // Direct message → only the recipient's personal channel
            return app.channel(`direct/${recipientId}`);
        }

        if (type === 'broadcast') {
            // Broadcast → everyone *except* the sender
            return app
                .channel('all')
                .filter((conn: RealTimeConnection) => (conn as any).clientId !== senderId);
        }

        if (type === 'room-message' && roomId) {
            // Room message → room members *except* the sender
            return app
                .channel(`rooms/${roomId}`)
                .filter((conn: RealTimeConnection) => (conn as any).clientId !== senderId);
        }

        // Don't publish anything else (e.g. internal events)
        return null;
    });

    // ── Rooms service publishing rules ───────────────────────────────────────
    // Notify *both* participants when a room is created
    app.service('rooms').publish((data: any, _context: any) => {
        return [
            app.channel(`direct/${data.userId}`),
            app.channel(`direct/${data.partnerId}`),
        ];
    });
}
