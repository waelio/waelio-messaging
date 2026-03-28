import { task } from "@renderinc/sdk/workflows";

const TARGET_URL = "https://waelio-app.onrender.com/";
const PING_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Sends a single HTTP GET to the target URL and returns the status code.
 * If the app was sleeping this wakes it up.
 */
const pingOnce = task(
    { name: "pingOnce" },
    async function pingOnce(url: string): Promise<{ url: string; status: number; ok: boolean; ts: string }> {
        const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
        const result = { url, status: res.status, ok: res.ok, ts: new Date().toISOString() };
        console.log(`[keepAlive] ping ${url} → ${res.status}`);
        return result;
    }
);

/**
 * Long-running keep-alive loop.
 * Pings the target every 10 minutes indefinitely.
 *
 * Run locally:
 *   render workflows tasks start keepAlive --local --input='[]'
 *
 * Run against deployed workflow:
 *   render workflows tasks start keepAlive --input='[]'
 */
task(
    {
        name: "keepAlive",
        // Allow up to 24 hours (Render Workflows max)
        // Restart from a cron job if needed for true indefinite uptime
        timeout: 86_400,
    },
    async function keepAlive(): Promise<void> {
        console.log(`[keepAlive] Starting — will ping ${TARGET_URL} every ${PING_INTERVAL_MS / 60_000} minutes`);

        while (true) {
            await pingOnce(TARGET_URL);
            await new Promise((resolve) => setTimeout(resolve, PING_INTERVAL_MS));
        }
    }
);

// The task server starts automatically when RENDER_SDK_SOCKET_PATH is set.
// No manual startTaskServer() call needed.
