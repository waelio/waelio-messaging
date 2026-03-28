/**
 * Feathers-compatible rooms service.
 *
 * Replaces the 'join-room' case in _handleClientMessage.
 *
 * create({ with: partnerId }, params) — adds both connections to the
 *   'rooms/<roomId>' channel so subsequent room-message events are
 *   routed there by channels.ts.
 */
export declare class RoomsService {
    private app;
    constructor(app: any);
    create(data: any, params?: any): Promise<any>;
}
