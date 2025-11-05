// public/app.js

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const elements = {
        connectBtn: document.getElementById('connectBtn'),
        statusSpan: document.getElementById('status'),
        destinationIdInput: document.getElementById('destinationId'),
        messageTextInput: document.getElementById('messageText'),
        sendBtn: document.getElementById('sendBtn'),
        broadcastBtn: document.getElementById('broadcastBtn'),
        logDiv: document.getElementById('log'),
        userList: document.getElementById('userList'),
        clientIdContainer: document.getElementById('clientIdContainer'),
        clientIdInput: document.getElementById('clientIdInput'),
        copyIdBtn: document.getElementById('copyIdBtn'),
        typingIndicator: document.getElementById('typingIndicator'),
    };

    // --- State ---
    let clientId = null; // Will be set by the server
    let ws = null;
    let currentRoom = null; // { roomId: string, with: string }
    let typingTimeout = null;
    let isTyping = false;
    // A set to store the IDs of users who are currently typing.
    const usersTyping = new Set();

    // --- Helper Functions ---
    function logMessage(message, type = 'info') {
        const p = document.createElement('p');
        p.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
        p.className = `log-${type}`; // Use a prefix to avoid conflicts
        elements.logDiv.appendChild(p);
        elements.logDiv.scrollTop = elements.logDiv.scrollHeight; // Auto-scroll
    }

    function updateUIForConnectedState() {
        elements.statusSpan.textContent = `Registered as '${clientId}'`;
        if (currentRoom) {
            elements.statusSpan.textContent += ` | In chat with ${currentRoom.with.substring(0, 8)}...`;
        }
        elements.connectBtn.textContent = 'Disconnect';
        elements.sendBtn.disabled = false;
        elements.broadcastBtn.disabled = false;
        elements.clientIdInput.value = clientId;
        elements.clientIdContainer.style.display = 'flex';
    }

    function updateUIForDisconnectedState() {
        elements.statusSpan.textContent = 'Disconnected';
        elements.connectBtn.textContent = 'Connect';
        elements.sendBtn.disabled = true;
        elements.broadcastBtn.disabled = true;
        elements.clientIdContainer.style.display = 'none';
        elements.userList.innerHTML = '';
        currentRoom = null;
    }

    function updateUserList(users) {
        elements.userList.innerHTML = ''; // Clear the list
        users.forEach(user => {
            const li = document.createElement('li');
            li.textContent = user;
            if (user === clientId) {
                li.textContent += ' (You)';
                li.className = 'me';
            }
            // Make other users clickable to start a chat
            if (user !== clientId) {
                li.style.cursor = 'pointer';
                li.title = `Click to chat with ${user.substring(0, 8)}...`;
                li.addEventListener('click', () => {
                    ws.send(JSON.stringify({ type: 'join-room', with: user }));
                });
            }
            elements.userList.appendChild(li);
        });
    }

    function updateTypingIndicator() {
        if (usersTyping.size === 0) {
            elements.typingIndicator.textContent = '';
            return;
        }

        const names = Array.from(usersTyping);
        if (names.length === 1) {
            elements.typingIndicator.textContent = `${names[0].substring(0, 8)}... is typing...`;
        } else if (names.length === 2) {
            elements.typingIndicator.textContent = `${names[0].substring(0, 8)} and ${names[1].substring(0, 8)} are typing...`;
        } else {
            elements.typingIndicator.textContent = 'Several people are typing...';
        }
    }

    // --- WebSocket Logic ---
    function connect() {
        logMessage('Connecting to server...', 'status');
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}`;
        ws = new WebSocket(wsUrl);
        setupWebSocketHandlers(ws);
    }

    function disconnect() {
        if (ws) {
            ws.close();
        }
    }

    function setupWebSocketHandlers(wsInstance) {
        ws.onopen = () => {
            elements.statusSpan.textContent = 'Connected. Waiting for registration...';
            logMessage('Connection opened. Waiting for server to assign ID...');
        };

        ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                switch (message.type) {
                    case 'register-success':
                        clientId = message.id;
                        logMessage(`Successfully registered with ID: ${clientId}`, 'status');
                        updateUIForConnectedState();
                        break;
                    case 'user-list':
                        updateUserList(message.users);
                        break;
                    case 'user-typing':
                        usersTyping.add(message.id);
                        updateTypingIndicator();
                        break;
                    case 'user-stopped-typing':
                        usersTyping.delete(message.id);
                        updateTypingIndicator();
                        break;
                    case 'joined-room':
                        currentRoom = { roomId: message.roomId, with: message.with };
                        logMessage(`You have entered a private chat with ${message.with.substring(0, 8)}...`, 'status');
                        updateUIForConnectedState(); // Update status text
                        break;
                    case 'partner-left-room':
                        if (currentRoom && currentRoom.roomId === message.roomId) {
                            logMessage(`Your chat partner has left the room.`, 'status');
                            currentRoom = null;
                        }
                        break;
                    default:
                        logMessage(`Received: ${JSON.stringify(message)}`, 'received');
                }
            } catch (error) {
                logMessage(`Error parsing server message: ${event.data}`, 'error');
            }
        };

        ws.onclose = () => {
            ws = null; // Clear the instance
            clientId = null; // Clear the ID
            usersTyping.clear();
            currentRoom = null;
            updateTypingIndicator();
            updateUIForDisconnectedState();
            logMessage('Connection closed.', 'status');
        };

        ws.onerror = (error) => {
            console.error('WebSocket Error:', error);
            logMessage('WebSocket error occurred. See console for details.', 'error');
        };
    }

    // --- Event Listeners ---
    function init() {
        elements.connectBtn.addEventListener('click', () => {
            if (ws) {
                disconnect();
            } else {
                connect();
            }
        });

        elements.copyIdBtn.addEventListener('click', () => {
            if (!clientId) return;
            navigator.clipboard.writeText(clientId).then(() => {
                logMessage('Your ID has been copied to the clipboard!', 'status');
            }).catch(err => {
                console.error('Failed to copy ID: ', err);
                logMessage('Failed to copy ID to clipboard.', 'error');
            });
        });

        elements.sendBtn.addEventListener('click', () => {
            if (!ws || ws.readyState !== WebSocket.OPEN) {
                alert('Not connected to the server.');
                return;
            }

            const messageText = elements.messageTextInput.value.trim();
            if (!messageText) return;

            // If in a room, send a room message. Otherwise, fall back to direct routing.
            if (currentRoom) {
                const message = {
                    type: 'room-message',
                    payload: { text: messageText, timestamp: new Date().toISOString() }
                };
                ws.send(JSON.stringify(message));
                logMessage(`Sent to room: ${messageText}`, 'sent');
            } else {
                const destinationId = elements.destinationIdInput.value.trim();
                if (!destinationId) {
                    alert('You are not in a chat room. Please provide a Destination ID.');
                    return;
                }
                const message = {
                    type: 'route',
                    to: destinationId,
                    payload: { text: messageText, timestamp: new Date().toISOString() }
                };
                ws.send(JSON.stringify(message));
                logMessage(`Sent to '${destinationId}': ${messageText}`, 'sent');
            }
            elements.messageTextInput.value = ''; // Clear input after sending
        });

        elements.broadcastBtn.addEventListener('click', () => {
            if (!ws || ws.readyState !== WebSocket.OPEN) {
                alert('Not connected to the server.');
                return;
            }

            const messageText = elements.messageTextInput.value.trim();

            if (!messageText) {
                alert('Please provide a message to broadcast.');
                return;
            }

            const message = {
                type: 'broadcast',
                payload: { text: messageText, timestamp: new Date().toISOString() }
            };

            ws.send(JSON.stringify(message));
            logMessage(`Broadcasted: ${messageText}`, 'sent');
            elements.messageTextInput.value = ''; // Clear input after sending
        });

        elements.messageTextInput.addEventListener('input', () => {
            if (!ws || ws.readyState !== WebSocket.OPEN) return;

            // If not already typing, send start-typing message
            if (!isTyping) {
                isTyping = true;
                ws.send(JSON.stringify({ type: 'start-typing' }));
            }

            // Clear previous timeout
            clearTimeout(typingTimeout);

            // Set a new timeout to send stop-typing message
            typingTimeout = setTimeout(() => {
                isTyping = false;
                ws.send(JSON.stringify({ type: 'stop-typing' }));
            }, 2000); // 2-second delay
        });
    }

    // --- Start the application ---
    init();
});