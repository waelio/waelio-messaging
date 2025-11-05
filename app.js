// public/app.js

document.addEventListener('DOMContentLoaded', () => {
    const clientIdInput = document.getElementById('clientId');
    const connectBtn = document.getElementById('connectBtn');
    const statusSpan = document.getElementById('status');
    const destinationIdInput = document.getElementById('destinationId');
    const messageTextInput = document.getElementById('messageText');
    const sendBtn = document.getElementById('sendBtn');
    const logDiv = document.getElementById('log');

    let ws = null;

    function logMessage(message, type = 'info') {
        const p = document.createElement('p');
        p.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
        p.className = type;
        logDiv.appendChild(p);
        logDiv.scrollTop = logDiv.scrollHeight; // Auto-scroll
    }

    connectBtn.addEventListener('click', () => {
        if (ws) {
            ws.close();
        }

        const clientId = clientIdInput.value.trim();
        if (!clientId) {
            alert('Please enter a Client ID.');
            return;
        }

        // Determine WebSocket protocol (ws or wss)
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}`;

        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
            statusSpan.textContent = `Connected. Registering as '${clientId}'...`;
            connectBtn.textContent = 'Disconnect';
            sendBtn.disabled = false;

            const registrationMessage = {
                type: 'register',
                id: clientId
            };
            ws.send(JSON.stringify(registrationMessage));
            logMessage(`Attempting to register as '${clientId}'...`);
        };

        ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                logMessage(`Received: ${JSON.stringify(message)}`, 'received');

                if (message.type === 'info' && message.message.includes('Successfully registered')) {
                    statusSpan.textContent = `Registered as '${clientId}'`;
                }
            } catch (error) {
                logMessage(`Error parsing server message: ${event.data}`, 'error');
            }
        };

        ws.onclose = () => {
            statusSpan.textContent = 'Disconnected';
            connectBtn.textContent = 'Connect & Register';
            sendBtn.disabled = true;
            ws = null;
            logMessage('Connection closed.', 'status');
        };

        ws.onerror = (error) => {
            console.error('WebSocket Error:', error);
            logMessage('WebSocket error occurred. See console for details.', 'error');
        };
    });

    sendBtn.addEventListener('click', () => {
        if (!ws || ws.readyState !== WebSocket.OPEN) {
            alert('Not connected to the server.');
            return;
        }

        const destinationId = destinationIdInput.value.trim();
        const messageText = messageTextInput.value.trim();

        if (!destinationId || !messageText) {
            alert('Please provide a destination ID and a message.');
            return;
        }

        const message = {
            type: 'route',
            to: destinationId,
            payload: {
                text: messageText,
                timestamp: new Date().toISOString()
            }
        };

        ws.send(JSON.stringify(message));
        logMessage(`Sent to '${destinationId}': ${messageText}`, 'sent');
        messageTextInput.value = ''; // Clear input after sending
    });
});