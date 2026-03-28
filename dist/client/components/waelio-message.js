/// <reference lib="dom" />
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
const RETRY_DELAYS = [1000, 2000, 5000, 10000, 20000];
class WaelioMessageElement extends HTMLElement {
    ws = null;
    clientId = '';
    connected = false;
    attempt = 0;
    shouldReconnect = true;
    pendingSend = null;
    static get observedAttributes() {
        return ['target', 'message', 'broadcast', 'ws-url', 'send-on', 'reconnect'];
    }
    get target() { return this.getAttribute('target') || ''; }
    set target(v) { this.setAttribute('target', v); }
    get message() { return this.getAttribute('message') || ''; }
    set message(v) { this.setAttribute('message', v); }
    get broadcast() { return this.hasAttribute('broadcast'); }
    set broadcast(v) { v ? this.setAttribute('broadcast', '') : this.removeAttribute('broadcast'); }
    get wsUrl() { return this.getAttribute('ws-url') || this._defaultWsUrl(); }
    set wsUrl(v) { this.setAttribute('ws-url', v); }
    get sendOn() {
        const v = this.getAttribute('send-on');
        return (v === 'manual' || v === 'click') ? v : 'connect';
    }
    set sendOn(v) { this.setAttribute('send-on', v); }
    get reconnect() { return this.hasAttribute('reconnect'); }
    set reconnect(v) { v ? this.setAttribute('reconnect', '') : this.removeAttribute('reconnect'); }
    connectedCallback() {
        if (!this.hasAttribute('reconnect'))
            this.reconnect = true;
        if (this.sendOn === 'click') {
            this.style.cursor = 'pointer';
            this.addEventListener('click', () => this.send());
        }
        this.connect();
    }
    disconnectedCallback() {
        this.shouldReconnect = false;
        this.disconnect();
    }
    attributeChangedCallback() {
        // No immediate action needed; getters reflect current attributes.
    }
    connect() {
        if (this.ws)
            return; // Already connecting/connected
        const url = this.wsUrl;
        try {
            this.ws = new WebSocket(url);
        }
        catch (e) {
            this._emitError(e instanceof Error ? e : new Error(String(e)));
            return;
        }
        this.ws.onopen = () => {
            this.connected = true;
            this._emit('connected', { clientId: this.clientId });
        };
        this.ws.onmessage = (ev) => this._handleInbound(ev.data);
        this.ws.onclose = (ev) => {
            const prevConnected = this.connected;
            this.connected = false;
            this.ws = null;
            this._emit('disconnected', { reason: ev.reason || 'closed' });
            if (prevConnected && this.reconnect && this.shouldReconnect) {
                this._scheduleReconnect();
            }
        };
        this.ws.onerror = () => this._emitError(new Error('WebSocket error'));
    }
    disconnect() {
        if (this.ws) {
            this.ws.close(1000, 'component detached');
            this.ws = null;
        }
    }
    send(messageOverride, targetOverride, opts = {}) {
        const payload = (messageOverride ?? this.message).trim();
        const to = targetOverride ?? this.target;
        const broadcast = opts.broadcast ?? this.broadcast;
        if (!payload)
            return; // Silently ignore empty
        if (!broadcast && !to) {
            this._emitError(new Error('Missing target for non-broadcast send'));
            return;
        }
        const attemptSend = () => {
            if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
                this.pendingSend = attemptSend;
                return;
            }
            const msg = broadcast
                ? { type: 'broadcast', payload }
                : { type: 'route', to, payload };
            try {
                this.ws.send(JSON.stringify(msg));
                this._emit('sent', { clientId: this.clientId, to: broadcast ? null : to, payload, broadcast });
            }
            catch (e) {
                this._emitError(e instanceof Error ? e : new Error(String(e)));
            }
        };
        attemptSend();
    }
    _handleInbound(raw) {
        let msg;
        try {
            msg = JSON.parse(raw);
        }
        catch {
            return;
        }
        if (msg.type === 'register-success') {
            this.clientId = msg.id;
            // If we have a pending send or send-on=connect, execute
            if (this.pendingSend) {
                const fn = this.pendingSend;
                this.pendingSend = null;
                fn();
            }
            else if (this.sendOn === 'connect' && this.message) {
                this.send();
            }
        }
        else if (msg.type === 'error') {
            this._emitError(new Error(msg.message || 'Hub error'));
        }
    }
    _scheduleReconnect() {
        const delay = RETRY_DELAYS[Math.min(this.attempt, RETRY_DELAYS.length - 1)];
        this.attempt++;
        setTimeout(() => {
            if (!this.shouldReconnect)
                return;
            this.connect();
        }, delay);
    }
    _defaultWsUrl() {
        const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
        return `${proto}//${location.host}`;
    }
    _emit(name, detail) {
        this.dispatchEvent(new CustomEvent(name, { detail }));
    }
    _emitError(error) {
        this._emit('error', { error });
    }
}
if (!customElements.get('waelio-message')) {
    customElements.define('waelio-message', WaelioMessageElement);
}
export { WaelioMessageElement };
