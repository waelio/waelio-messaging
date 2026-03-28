/**
 * <waelio-message> custom element
 * Sends a WebSocket message to the messaging hub.
 *
 * Attributes:
 *  - target: recipient client ID (omit & use broadcast to send to all)
 *  - message: message text/payload
 *  - broadcast: boolean attribute to broadcast
 *  - ws-url: override WebSocket URL (defaults to same origin)
 *  - send-on: "connect" (default), "manual", or "click"
 *  - reconnect: boolean attribute to auto reconnect with backoff
 *
 * Methods:
 *  - send(message?: string, target?: string, opts?: { broadcast?: boolean })
 *  - connect()
 *  - disconnect()
 *
 * Events (CustomEvent):
 *  - connected { clientId }
 *  - disconnected { reason }
 *  - sent { clientId, to, payload, broadcast }
 *  - error { error }
 */
interface WaelioMessageSendOptions {
    broadcast?: boolean;
}
type SendOnMode = 'connect' | 'manual' | 'click';
declare class WaelioMessageElement extends HTMLElement {
    private ws;
    private clientId;
    private connected;
    private attempt;
    private shouldReconnect;
    private pendingSend;
    static get observedAttributes(): string[];
    get target(): string;
    set target(v: string);
    get message(): string;
    set message(v: string);
    get broadcast(): boolean;
    set broadcast(v: boolean);
    get wsUrl(): string;
    set wsUrl(v: string);
    get sendOn(): SendOnMode;
    set sendOn(v: SendOnMode);
    get reconnect(): boolean;
    set reconnect(v: boolean);
    connectedCallback(): void;
    disconnectedCallback(): void;
    attributeChangedCallback(): void;
    connect(): void;
    disconnect(): void;
    send(messageOverride?: string, targetOverride?: string, opts?: WaelioMessageSendOptions): void;
    private _handleInbound;
    private _scheduleReconnect;
    private _defaultWsUrl;
    private _emit;
    private _emitError;
}
declare global {
    interface HTMLElementTagNameMap {
        'waelio-message': WaelioMessageElement;
    }
}
export { WaelioMessageElement };
