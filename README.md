# Welcom - Turn-Based Negotiation iOS App

Professional turn-based negotiation sessions for iOS with real-time features and session management.

## Features

- ✅ **Turn-Based Audio**: Automatic muting based on turn rotation
- ✅ **Session Timer**: Visual countdown with configurable turn duration
- ✅ **Private Notes**: Take notes during opponent's turn
- ✅ **Session Logging**: Complete session history with export capability
- ✅ **NFC Session Sharing**: Tap phones together to share/join sessions instantly
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
│   └── User.swift              # User information
├── ViewModels/
│   └── SessionViewModel.swift  # Session state & logic
├── Views/
│   ├── SessionView.swift       # Main session UI
│   ├── ContentView.swift       # Home screen
│   ├── CreateSessionView.swift # Create new session
│   ├── JoinSessionView.swift   # Join existing session
│   └── WaitingRoomView.swift   # Pre-session waiting area
├── Services/
│   └── NFCSessionManager.swift # NFC reading/writing
└── WelcomApp.swift            # App entry point
```

## Getting S
- iPhone 7 or later (for NFC functionality)tarted

### Prerequisites

- Xcode 14.0+
- iOS 15.0+
- Swift 5.0+

### Installation

1. Clone the repository:
```bash
git clone https://github.com/waelio/welcom.git
cd welcom
```

2. Open in Xcode:
```bash
open Welcom.xcodeproj
```

3. Build and run (⌘R)

### Configuration

The app currently runs with mock data for demonstration. To integrate with backend services:

1. **Firebase Integration** (Optional):
   - Add `GoogleService-Info.plist`
   - Configure Firebase in `WelcomApp.swift`

2. **WebRTC/Agora** (Optional):
   - Add audio framework dependencies
   - Configure in `SessionViewModel.swift`

3. **Bundle Identifier**:
   - Current: `com.waelio.Welcom`
   - Update in Xcode project settings if needed

## Usage
Creating and Joining Sessions

**Option 1: Using NFC (Recommended)**
1. **Host**: Tap "Create Session" → Fill details → Tap "Share via NFC"  
2. **Participant**: Tap "Join Session" → Tap "Scan with NFC"  
3. Hold phones back-to-back until code transfers  
4. Session automatically starts when both users are connected

**Option 2: Using Session Code**
1. **Host**: Tap "Create Session" → Share the 6-character code
2. **Participant**: Tap "Join Session" → Enter code manually
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

- ✅ NFC Session Sharing
- ⏳ Firebase Integration (planned)
- ⏳ Real-time Audio (planned)
- ⏳ User Authentication (planned)

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
