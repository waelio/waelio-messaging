import Foundation
import Combine

/// WebSocket service to connect to waelio-messaging backend
class WebSocketService: NSObject, ObservableObject {
    @Published var isConnected = false
    @Published var receivedMessages: [Message] = []
    @Published var onlineUsers: [String] = []
    @Published var error: String?
    
    private var webSocketTask: URLSessionWebSocketTask?
    private var session: URLSession?
    private let serverURL: String
    private let userId: String
    private let userName: String
    private var reconnectAttempt = 0
    private var reconnectWorkItem: DispatchWorkItem?
    private var shouldReconnect = true
    private let maxReconnectDelay: TimeInterval = 20
    
    struct Message: Codable, Identifiable {
        let id = UUID()
        let type: String
        let from: String
        let to: String?
        let content: String
        let timestamp: Date
        
        enum CodingKeys: String, CodingKey {
            case type, from, to, content, timestamp
        }
    }
    
    struct OutgoingMessage: Codable {
        let type: String
        let to: String?
        let content: String
    }
    
    init(serverURL: String? = nil, userId: String, userName: String) {
        self.serverURL = serverURL ?? Self.defaultServerURL()
        self.userId = userId
        self.userName = userName
        super.init()
        
        let configuration = URLSessionConfiguration.default
        session = URLSession(configuration: configuration, delegate: self, delegateQueue: OperationQueue())
    }

    private static func defaultServerURL() -> String {
        if let configured = Bundle.main.object(forInfoDictionaryKey: "WebSocketServerURL") as? String,
           !configured.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            return configured
        }

        return "wss://waelio-messaging.onrender.com"
    }
    
    // MARK: - Connection
    
    func connect() {
        shouldReconnect = true
        reconnectWorkItem?.cancel()

        guard let url = URL(string: serverURL) else {
            error = "Invalid server URL"
            return
        }
        
        webSocketTask = session?.webSocketTask(with: url)
        webSocketTask?.resume()
        isConnected = false
        
        // Start receiving messages
        receiveMessage()
    }
    
    func disconnect() {
        shouldReconnect = false
        reconnectWorkItem?.cancel()
        webSocketTask?.cancel(with: .goingAway, reason: nil)
        isConnected = false
    }
    
    // MARK: - Sending Messages
    
    private func sendJoin() {
        let joinMsg = OutgoingMessage(type: "join", to: nil, content: userName)
        sendMessage(joinMsg)
    }
    
    func sendDirectMessage(to userId: String, content: String) {
        let msg = OutgoingMessage(type: "direct", to: userId, content: content)
        sendMessage(msg)
    }
    
    func sendBroadcast(content: String) {
        let msg = OutgoingMessage(type: "broadcast", to: nil, content: content)
        sendMessage(msg)
    }
    
    private func sendMessage(_ message: OutgoingMessage) {
        guard let data = try? JSONEncoder().encode(message),
              let jsonString = String(data: data, encoding: .utf8) else {
            error = "Failed to encode message"
            return
        }
        
        let wsMessage = URLSessionWebSocketTask.Message.string(jsonString)
        webSocketTask?.send(wsMessage) { [weak self] error in
            if let error = error {
                DispatchQueue.main.async {
                    self?.error = "Send error: \(error.localizedDescription)"
                }
            }
        }
    }
    
    // MARK: - Receiving Messages
    
    private func receiveMessage() {
        webSocketTask?.receive { [weak self] result in
            guard let self = self else { return }
            
            switch result {
            case .success(let message):
                switch message {
                case .string(let text):
                    self.handleMessage(text)
                case .data(let data):
                    if let text = String(data: data, encoding: .utf8) {
                        self.handleMessage(text)
                    }
                @unknown default:
                    break
                }
                
                // Continue listening
                self.receiveMessage()
                
            case .failure(let error):
                DispatchQueue.main.async {
                    self.error = "Receive error: \(error.localizedDescription)"
                    self.isConnected = false
                }
                self.scheduleReconnectIfNeeded()
            }
        }
    }

    private func scheduleReconnectIfNeeded() {
        guard shouldReconnect else { return }

        reconnectWorkItem?.cancel()
        reconnectAttempt += 1

        let delay = min(pow(2.0, Double(reconnectAttempt)), maxReconnectDelay)
        let workItem = DispatchWorkItem { [weak self] in
            guard let self = self, self.shouldReconnect else { return }
            self.connect()
        }

        reconnectWorkItem = workItem
        DispatchQueue.main.asyncAfter(deadline: .now() + delay, execute: workItem)
    }
    
    private func handleMessage(_ text: String) {
        guard let data = text.data(using: .utf8) else { return }
        
        // Try to parse as a message
        if let message = try? JSONDecoder().decode(Message.self, from: data) {
            DispatchQueue.main.async {
                self.receivedMessages.append(message)
            }
            return
        }
        
        // Try to parse as user list update
        if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
           let type = json["type"] as? String,
           type == "users",
           let users = json["users"] as? [String] {
            DispatchQueue.main.async {
                self.onlineUsers = users
            }
        }
    }
    
    deinit {
        disconnect()
    }
}

// MARK: - URLSessionWebSocketDelegate

extension WebSocketService: URLSessionWebSocketDelegate {
    func urlSession(_ session: URLSession, webSocketTask: URLSessionWebSocketTask, didOpenWithProtocol protocol: String?) {
        DispatchQueue.main.async {
            self.isConnected = true
            self.error = nil
            self.reconnectAttempt = 0
            self.sendJoin()
        }
    }
    
    func urlSession(_ session: URLSession, webSocketTask: URLSessionWebSocketTask, didCloseWith closeCode: URLSessionWebSocketTask.CloseCode, reason: Data?) {
        DispatchQueue.main.async {
            self.isConnected = false
        }
        scheduleReconnectIfNeeded()
    }
}
