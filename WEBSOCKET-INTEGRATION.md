# WebSocket Integration Guide

This guide explains how to enable real-time communication between devices using the [waelio-messaging](https://github.com/waelio/waelio-messaging.git)` backend.

## Current State

The app currently works in **standalone mode**:
- ✅ QR code scanning to share session codes
- ✅ Manual code entry
- ✅ All UI and session logic complete
- ❌ No real-time sync between devices

## Enable Real-Time Sync

### Step 1: Start the Messaging Server

```bash
cd /Users/waelio/Code/waelio-messaging
npm install
npm run dev
```

Server will run on `http://localhost:8080`

### Step 2: Get Your Mac's Local IP

For physical iOS devices to connect:

```bash
ifconfig | grep "inet " | grep -v 127.0.0.1
```

Example output: `inet 192.168.1.100`

### Step 3: Update Server URL

In `Welcom/Services/WebSocketService.swift`, line 22:

```swift
// For simulator (localhost)
init(serverURL: String = "ws://localhost:8080", userId: String, userName: String)

// For physical devices, change to your Mac's IP:
init(serverURL: String = "ws://192.168.1.100:8080", userId: String, userName: String)
```

### Step 4: Integrate in SessionViewModel

In `Welcom/ViewModels/SessionViewModel.swift`, uncomment and implement:

```swift
// Add properties (around line 22)
private var webSocketService: WebSocketService?
private var sessionMessaging: SessionMessagingService?

// In init() method, after setting up session:
webSocketService = WebSocketService(userId: currentUserId, userName: userName)
if let session = session {
    sessionMessaging = SessionMessagingService(
        webSocket: webSocketService!,
        sessionCode: session.sessionCode
    )
    webSocketService?.connect()
    sessionMessaging?.announceSession(userId: currentUserId, userName: userName)
    
    // Listen for participant joining
    sessionMessaging?.$participantJoined
        .sink { [weak self] joined in
            if joined {
                self?.handleParticipantJoined()
            }
        }
        .store(in: &cancellables)
}

// Add helper method:
private func handleParticipantJoined() {
    guard var session = session, session.status == .waiting else { return }
    session.partyBId = "participant-joined"
    session.status = .active
    session.turnStartedAt = Date()
    self.session = session
    addLogEntry(type: .userJoined, message: "Party B joined the session")
    addLogEntry(type: .turnStarted, message: "\(session.currentTurn.displayName) turn started")
    startTimer()
    updateMuteStatus()
}
```

### Step 5: Test

1. Build to two physical devices (or one device + simulator)
2. Both devices must be on same WiFi network as your Mac
3. Device A: Create session
4. Device B: Join with QR code or session code
5. Watch them sync in real-time via WebSocket!

## Message Types

The system uses these message types (defined in `SessionMessagingService.swift`):

- `join-session` - User announces they're in a session
- `session-state` - Broadcast current session state (turn, time, etc)
- `turn-update` - Turn changed
- `request` - Modification request (pause, extend, etc)

## Troubleshooting

### Devices can't connect to server

- Ensure Mac and iOS devices on same WiFi
- Check firewall isn't blocking port 8080
- Verify server URL in `WebSocketService.swift`

### Connection works but no sync

- Check browser console in messaging server (errors?)
- Ensure both devices using same session code
- Verify `SessionMessagingService` is instantiated

### "Cannot connect to localhost"

- Simulator: use `localhost`
- Physical device: must use Mac's local IP (`192.168.1.x`)

## Architecture

```
┌─────────────┐         WebSocket          ┌─────────────────┐
│  Device A   │◄────────────────────────────┤                 │
│  (Host)     │         Messages            │  waelio-        │
└─────────────┘                             │  messaging      │
                                            │  Server         │
┌─────────────┐                             │                 │
│  Device B   │◄────────────────────────────┤  (Node.js)      │
│ (Participant)│                             │                 │
└─────────────┘                             └─────────────────┘
```

## Why WebSocket?

- **Real-time**: Instant state sync between devices
- **Efficient**: Low overhead, persistent connection
- **Proven**: Your existing `waelio-messaging` infrastructure
- **Scalable**: Can add more features (chat, reactions, etc)

## Future Enhancements

Once WebSocket is working:

1. **Sync turn timer** - Both devices see same countdown
2. **Real-time requests** - Modification requests appear instantly
3. **Presence detection** - Know when other person disconnects
4. **Chat messages** - Add text chat during turns
5. **Session recovery** - Reconnect after network drop
