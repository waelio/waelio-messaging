import 'dotenv/config';
import http from 'http';
declare const app: import("express-serve-static-core").Express;
declare const server: http.Server<typeof http.IncomingMessage, typeof http.ServerResponse>;
export { app, server };
export declare function startServer(): Promise<void>;
