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
export declare function configureChannels(app: any): void;
