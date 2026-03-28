import type { RealTimeConnection } from '@feathersjs/feathers';

/**
 * Feathers-compatible rooms service.
 *
 * Replaces the 'join-room' case in _handleClientMessage.
 *
 * create({ with: partnerId }, params) — adds both connections to the
 *   'rooms/<roomId>' channel so subsequent room-message events are
 *   routed there by channels.ts.
 */
export class RoomsService {
    private app: any;

    constructor(app: any) {
        this.app = app;
    }

    async create(data: any, params?: any): Promise<any> {
        const userId: string = (params?.connection as any)?.clientId;
        const partnerId: string = data.with;

        if (!userId || !partnerId || userId === partnerId) {
            throw new Error('Invalid room request: provide a different partner ID');
        }

        // Look up both connections from the global channel
        const allConns: RealTimeConnection[] = this.app.channel('all').connections;
        const userConn = allConns.find((c: any) => c.clientId === userId);
        const partnerConn = allConns.find((c: any) => c.clientId === partnerId);

        if (!partnerConn) {
            throw new Error(`User '${partnerId}' is not online`);
        }

        const roomId = [userId, partnerId].sort().join('-');

        // Join both connections to the room channel
        if (userConn) {
            (userConn as any).roomId = roomId;
            this.app.channel(`rooms/${roomId}`).join(userConn);
        }
        (partnerConn as any).roomId = roomId;
        this.app.channel(`rooms/${roomId}`).join(partnerConn);

        console.log(`[Rooms] '${userId}' and '${partnerId}' joined room '${roomId}'`);

        // The returned object is published to both participants via channels.ts
        return { roomId, userId, partnerId };
    }
}
