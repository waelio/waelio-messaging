import Foundation
import Combine

/// Manages real-time session synchronization using waelio-messaging
class SessionMessagingService: ObservableObject {
    @Published var participantJoined = false
    @Published var sessionState: SessionSyncMessage?
    
    private let webSocket: WebSocketService
    private let sessionCode: String
    private var cancellables = Set<AnyCancellable>()
    
    struct SessionSyncMessage: Codable {
        let type: String // "join-session", "session-state", "turn-update", "request"
        let sessionCode: String
        let userId: String
        let userName: String?
        let session: SessionData?
        let requestType: String?
        
        struct SessionData: Codable {
            let currentTurn: String
            let currentTurnNumber: Int
            let timeRemaining: Double
            let status: String
        }
    }
    
    init(webSocket: WebSocketService, sessionCode: String) {
        self.webSocket = webSocket
        self.sessionCode = sessionCode
        
        // Listen for incoming messages
        webSocket.$receivedMessages
            .sink { [weak self] messages in
                guard let self = self, let lastMessage = messages.last else { return }
                self.handleIncomingMessage(lastMessage)
            }
            .store(in: &cancellables)
    }
    
    // MARK: - Session Actions
    
    func announceSession(userId: String, userName: String) {
        let message = SessionSyncMessage(
            type: "join-session",
            sessionCode: sessionCode,
            userId: userId,
            userName: userName,
            session: nil,
            requestType: nil
        )
        
        sendSessionMessage(message)
    }
    
    func broadcastSessionState(
        userId: String,
        currentTurn: String,
        currentTurnNumber: Int,
        timeRemaining: Double,
        status: String
    ) {
        let sessionData = SessionSyncMessage.SessionData(
            currentTurn: currentTurn,
            currentTurnNumber: currentTurnNumber,
            timeRemaining: timeRemaining,
            status: status
        )
        
        let message = SessionSyncMessage(
            type: "session-state",
            sessionCode: sessionCode,
            userId: userId,
            userName: nil,
            session: sessionData,
            requestType: nil
        )
        
        sendSessionMessage(message)
    }
    
    func sendModificationRequest(userId: String, requestType: String) {
        let message = SessionSyncMessage(
            type: "request",
            sessionCode: sessionCode,
            userId: userId,
            userName: nil,
            session: nil,
            requestType: requestType
        )
        
        sendSessionMessage(message)
    }
    
    // MARK: - Internal
    
    private func sendSessionMessage(_ message: SessionSyncMessage) {
        guard let data = try? JSONEncoder().encode(message),
              let jsonString = String(data: data, encoding: .utf8) else {
            return
        }
        
        webSocket.sendBroadcast(content: jsonString)
    }
    
    private func handleIncomingMessage(_ message: WebSocketService.Message) {
        // Try to decode as session sync message
        guard let data = message.content.data(using: .utf8),
              let syncMessage = try? JSONDecoder().decode(SessionSyncMessage.self, from: data) else {
            return
        }
        
        // Only process messages for this session
        guard syncMessage.sessionCode == sessionCode else { return }
        
        switch syncMessage.type {
        case "join-session":
            participantJoined = true
            
        case "session-state":
            sessionState = syncMessage
            
        default:
            break
        }
    }
}
