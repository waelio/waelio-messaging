# Welcom - Safe Communication for Difficult Conversations

Welcom facilitates safe, friendly, and respectful communication between parties during difficult conversations. By enforcing turn-based speaking with automatic muting, both people can express themselves without interruption, yelling, or talking over each other.

## Why Welcom?

Difficult conversations often break down when people interrupt, raise voices, or talk over each other. Welcom creates a structured, safe space for communication by:

- **Preventing Interruptions**: Only one person can speak at a time
- **Equal Voice**: Both parties get fair, timed turns to express themselves
- **Reducing Tension**: Automatic muting prevents heated overlapping arguments
- **Promoting Respect**: Turn-based structure encourages thoughtful listening
- **Building Understanding**: Private notes help process what you hear without immediate reaction

Perfect for: couples therapy, family discussions, workplace conflicts, mediation sessions, or any conversation that needs structure.

## Features

- ✅ **Turn-Based Audio**: Automatic muting based on turn rotation
- ✅ **Session Timer**: Visual countdown with configurable turn duration
- ✅ **Private Notes**: Take notes during opponent's turn
- ✅ **Session Logging**: Complete session history with export capability
- ✅ **Session Ratings**: Rate negotiation quality and respectfulness after completion
- ✅ **Multiple Sharing Options**: AirDrop, QR codes, NFC, or manual codes
- ✅ **Modification Requests**: Request and approve session changes
  - Extend turn duration
  - Add extra turns
  - Pause/Resume session
  - End session
- ✅ **Real-time Sync**: Session state synchronized between parties (ready for Firebase)
- ✅ **SwiftUI + MVVM**: Clean architecture with reactive state management

## Architecture

```
Welcom/
├── Models/
│   ├── Session.swift           # Session data model
│   ├── Note.swift              # Private notes model
│   ├── LogEntry.swift          # Session logging
│   ├── ModificationRequest.swift # Request workflow
│   ├── SessionRating.swift     # Post-session ratings
│   └── User.swift              # User information
├── ViewModels/
│   └── SessionViewModel.swift  # Session state & logic
├── Views/
│   ├── SessionView.swift       # Main session UI
│   ├── ContentView.swift       # Home screen
│   ├── CreateSessionView.swift # Create new session
│   ├── JoinSessionView.swift   # Join existing session
│   ├── WaitingRoomView.swift   # Pre-session waiting area
│   └── SessionRatingView.swift # Post-session feedback
├── Services/
│   ├── NFCSessionManager.swift       # NFC reading/writing
│   ├── QRCodeGenerator.swift         # QR code generation
│   ├── QRCodeScanner.swift           # QR code scanning (camera)
│   ├── WebSocketService.swift        # Real-time messaging client
│   └── SessionMessagingService.swift # Session sync via WebSocket
├── Utils/
│   └── ShareSheet.swift              # AirDrop & share menu
└── WelcomApp.swift                  # App entry point
```

## Getting Started

### Prerequisites

- Xcode 14.0+
- iOS 15.0+
- Swift 5.0+
- iPhone 7 or later (for NFC functionality)
- Node.js 18+ (for real-time messaging - optional)

### Installation

#### Option 1: Demo Mode (Single Device)

1. Clone the repository:
```bash
git clone https://github.com/waelio/welcom.git
cd welcom
```

2. Open in Xcode:
```bash
open Welcom.xcodeproj
```

3. Build and run (⌘R) - Uses demo button for simulation

#### Option 2: Real-Time Mode (Two Devices)

For real device-to-device communication using QR codes or session codes:

1. Follow steps 1-2 from Option 1
2. Build to two physical devices
3. Create session on device A, join from device B
4. Currently works with QR code scanning or manual code entry

#### Option 3: Backend Integration (Real-Time Sync)

For full real-time synchronization with WebSocket messaging:

1. **Start the messaging server** (in a separate terminal):
```bash
cd /Users/waelio/Code/waelio-messaging
npm install
npm run dev
# Server runs on http://localhost:8080
```

2. **Configure the iOS app** to connect to the server:
   - In `WebSocketService.swift`, server URL is already set to `ws://localhost:8080`
   - For physical devices, change to your Mac's local IP: `ws://192.168.1.x:8080`

3. **Build and run** on two devices - they'll communicate via WebSocket

**Note**: Option 3 requires both devices to be on the same network as your Mac running the messaging server.

### Configuration

The app has three integration levels:

1. **Demo Mode (Current)**:
   - Mock data, single device testing
   - "Simulate Join" button for testing UI

2. **Peer-to-Peer Mode (Production-Ready, No Backend Required)**:
   - ✅ **AirDrop**: Share code instantly between nearby devices
   - ✅ **QR Code**: Scan to join, works at any distance
   - ✅ **Manual Code**: Fallback 6-character code entry
   - ✅ **NFC**: Tap phones together (iPhone 7+)
   - Works completely offline, no server needed

3. **WebSocket Mode (Full Real-Time)**:
   - Use `waelio-messaging` backend for live sync
   - Real-time turn management
   - User presence detection
   - Requires messaging server running

**To enable WebSocket sync**:
- Uncomment WebSocket integration in `SessionViewModel.swift`
- Set server URL in `WebSocketService.swift`
- Start messaging server: `cd /Users/waelio/Code/waelio-messaging && npm run dev`

**Audio Integration** (Future):
- Add WebRTC or Agora SDK
- Implement in `SessionViewModel.swift`
- Hook into existing mute/unmute logic

## Usage
Creating and Joining Sessions

**Option 1: Using AirDrop (Recommended)**
1. **Host**: Tap "Start Conversation" → Tap "Share via AirDrop"
2. **Participant**: Accept AirDrop → Code appears in message → Copy and paste into join screen
3. Session automatically starts when both users are connected

**Option 2: Using QR Code**
1. **Host**: Tap "Start Conversation" → Session shows QR code in waiting room
2. **Participant**: Tap "Join Conversation" → Tap "Scan QR Code" → Point camera at host's screen
3. Session automatically starts when both users are connected

**Option 3: Using NFC**
1. **Host**: Tap "Start Conversation" → Fill details → Tap "Share via NFC"  
2. **Participant**: Tap "Join Conversation" → Tap "Scan with NFC"  
3. Hold phones back-to-back until code transfers  
4. Session automatically starts when both users are connected

**Option 4: Using Session Code**
1. **Host**: Tap "Start Conversation" → Share the 6-character code
2. **Participant**: Tap "Join Conversation" → Enter code manually
3. Session starts when participant joins

### 
### Starting a Demo Session

1. Launch the app
2. Tap "Start Demo Session"
3. View the session interface with:
   - Circular timer showing remaining time
   - Party status indicators (A/B)
   - Private notes section
   - Session log
   - Control buttons

### Session Controls

- **Notes**: Take private notes during opponent's turn
- **Menu (⋯)**: Access modification requests
  - Extend Turn: Add 1 minute to current turn
  - Add Turn: Increase total number of turns
  - Pause/Resume: Temporarily halt the session
  - End Session: Terminate early with mutual consent
- **Export (↑)**: Save session log as text file

### Turn Management

## Project Status

- ✅ Core UI Implementation
- ✅ Session Management
- ✅ Timer & Turn Logic
- ✅ Notes & Logging
- ✅ Modification Requests
- ✅ QR Code Joining
- ✅ NFC Session Sharing
- ✅ WebSocket Service (waelio-messaging integration ready)
- ⏳ Full Real-Time Sync (backend running required)
- ⏳ Real-time Audio (planned)
- ⏳ User Authentication (planned)

## Real-Time Messaging Integration

Welcom includes WebSocket client code to integrate with the `waelio-messaging` backend for real device-to-device communication.

**Architecture:**
- `WebSocketService.swift` - Generic WebSocket client for waelio-messaging
- `SessionMessagingService.swift` - Session-specific sync logic
- Compatible with: https://github.com/waelio/waelio-messaging

**To use:**
1. Run messaging server: `cd /path/to/waelio-messaging && npm run dev`
2. Update server URL in `WebSocketService.swift` if needed
3. Enable WebSocket sync in `SessionViewModel` (currently commented out)
4. Both devices connect to same server
5. Session state syncs automatically

**Currently:** App works standalone with QR codes. WebSocket integration is implemented but optional.

## NFC Requirements

**Hardware:**
- iPhone 7 or later (iPhone XR/XS for background NFC)
- Both devices must support NFC

**Testing:**
- NFC only works on physical devices, not simulators
- Devices must have iOS 13.0 or later
- Hold devices back-to-back (where NFC antenna is located)
- Wait for haptic feedback confirming successful read/write

**Entitlements:**
- Near Field Communication Tag Reading capability is enabled
- NDEF format support is configured
  - Orange: 1-2 minutes remaining
  - Red: < 1 minute remaining

## Project Status

- ✅ Core UI Implementation
- ✅ Session Management
- ✅ Timer & Turn Logic
- ✅ Notes & Logging
- ✅ Modification Requests
- ⏳ Firebase Integration (planned)
- ⏳ Real-time Audio (planned)
- ⏳ User Authentication (planned)

## Development

### Building

```bash
xcodebuild -project Welcom.xcodeproj -scheme Welcom -destination 'platform=iOS Simulator,name=iPhone 15' build
```

### Running Tests

```bash
xcodebuild test -project Welcom.xcodeproj -scheme Welcom -destination 'platform=iOS Simulator,name=iPhone 15'
```

## License

MIT License - feel free to use this project for your own applications.

## Author

waelio

## Acknowledgments

- Built with SwiftUI
- Uses Combine for reactive programming
- MVVM architecture pattern
