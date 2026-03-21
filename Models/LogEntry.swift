import Foundation

struct LogEntry: Identifiable, Codable {
    let id: String
    let sessionId: String
    let type: LogType
    let message: String
    let timestamp: Date
    let metadata: [String: String]?
    
    enum LogType: String, Codable {
        case sessionStarted
        case sessionEnded
        case turnStarted
        case turnEnded
        case modificationRequested
        case modificationApproved
        case modificationDenied
        case noteAdded
        case pause
        case resume
        case userJoined
        case userLeft
    }
    
    init(id: String = UUID().uuidString,
         sessionId: String,
         type: LogType,
         message: String,
         timestamp: Date = Date(),
         metadata: [String: String]? = nil) {
        self.id = id
        self.sessionId = sessionId
        self.type = type
        self.message = message
        self.timestamp = timestamp
        self.metadata = metadata
    }
}
