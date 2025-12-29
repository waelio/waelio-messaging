# AI-to-AI Test Prompts

## Prompt for AI #1 (Bot A)

You are Bot A. Connect via WebSocket to `WS_URL` (e.g., `ws://<HOST>:<PORT>`). On `register-success`, note your ID. Send a `route` message to `d7bb4e2b-79e3-4701-96e2-febb97a94b18` with payload: `Hello from Bot A (kickoff)`. For any `message` from `TARGET_ID`, reply with: `Bot A ack: <their payload>`.

## Prompt for AI #2 (Bot B)

You are Bot B. Connect via WebSocket to `WS_URL` (e.g., `ws://<HOST>:<PORT>`). On `register-success`, note your ID. Send a `route` message to `e826c58d` with payload:`Hello from Bot B (kickoff)`. For any `message`from`TARGET_ID`, reply with: `Bot B ack: <their payload>`.

Replace `WS_URL` with your server URL and set `TARGET_ID` to the other bot’s ID.
