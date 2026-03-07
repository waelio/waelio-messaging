import Foundation

struct ModificationRequest: Identifiable, Codable {
    let id: String
    let sessionId: String
    let requestingUserId: String
    let type: ModificationType
    let reason: String
    var status: RequestStatus
    let createdAt: Date
    var respondedAt: Date?
    
    enum ModificationType: String, Codable {
        case extendTurn
        case addTurn
        case pauseSession
        case resumeSession
        case endSession
        
        var description: String {
            switch self {
            case .extendTurn: return "Extend Current Turn"
            case .addTurn: return "Add Extra Turn"
            case .pauseSession: return "Pause Session"
            case .resumeSession: return "Resume Session"
            case .endSession: return "End Session"
            }
        }
    }
    
    enum RequestStatus: String, Codable {
        case pending
        case approved
        case denied
    }
    
    init(id: String = UUID().uuidString,
         sessionId: String,
         requestingUserId: String,
         type: ModificationType,
         reason: String,
         status: RequestStatus = .pending,
         createdAt: Date = Date(),
         respondedAt: Date? = nil) {
        self.id = id
        self.sessionId = sessionId
        self.requestingUserId = requestingUserId
        self.type = type
        self.reason = reason
        self.status = status
        self.createdAt = createdAt
        self.respondedAt = respondedAt
    }
}
