import Foundation

struct Session: Identifiable, Codable {
    let id: String
    var title: String
    var conversationBrief: String?
    var sessionCode: String
    var status: SessionStatus
    var currentTurn: TurnParty
    var currentTurnNumber: Int
    var maxTurns: Int
    var turnDuration: TimeInterval
    var partyAId: String
    var partyBId: String
    var createdAt: Date
    var turnStartedAt: Date?
    
    enum SessionStatus: String, Codable {
        case waiting
        case active
        case paused
        case completed
    }
    
    enum TurnParty: String, Codable {
        case partyA
        case partyB
        
        var displayName: String {
            switch self {
            case .partyA: return "Party A"
            case .partyB: return "Party B"
            }
        }
    }
    
    init(id: String = UUID().uuidString,
         title: String,
            conversationBrief: String? = nil,
         sessionCode: String,
         status: SessionStatus = .waiting,
         currentTurn: TurnParty = .partyA,
         currentTurnNumber: Int = 1,
         maxTurns: Int = 10,
         turnDuration: TimeInterval = 120,
         partyAId: String,
         partyBId: String,
         createdAt: Date = Date(),
         turnStartedAt: Date? = nil) {
        self.id = id
        self.title = title
        self.conversationBrief = conversationBrief
        self.sessionCode = sessionCode
        self.status = status
        self.currentTurn = currentTurn
        self.currentTurnNumber = currentTurnNumber
        self.maxTurns = maxTurns
        self.turnDuration = turnDuration
        self.partyAId = partyAId
        self.partyBId = partyBId
        self.createdAt = createdAt
        self.turnStartedAt = turnStartedAt
    }
}
