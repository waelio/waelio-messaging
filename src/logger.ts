import pino from 'pino';

const baseLogger = pino({ level: process.env.LOG_LEVEL ?? 'info' });

export function createLogger(module: string) {
    return baseLogger.child({ module });
}

export default baseLogger;
