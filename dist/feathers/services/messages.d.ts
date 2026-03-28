/**
 * Feathers-compatible messages service.
 *
 * Replaces the route/broadcast/get-history cases of _handleClientMessage.
 *
 * create(data, params)  — persist and return the message; channels.ts
 *                         decides who receives the 'created' event.
 * find(params)          — return history for the calling client.
 */
export declare class MessagesService {
    private mongoClient;
    private collection;
    ready: Promise<void>;
    constructor(mongoURI?: string);
    private _setup;
    private _setupInMemory;
    /**
     * Create a message. Called when a client emits 'messages::create'.
     * The returned object is what channels.ts routes to the right subscribers.
     */
    create(data: any, params?: any): Promise<any>;
    /**
     * Return message history for the calling client.
     * Called when a client emits 'messages::find'.
     */
    find(params?: any): Promise<any[]>;
    close(): Promise<void>;
}
