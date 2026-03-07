import Foundation

struct Note: Identifiable, Codable {
    let id: String
    let sessionId: String
    let userId: String
    let content: String
    let createdAt: Date
    let turnNumber: Int
    
    init(id: String = UUID().uuidString,
         sessionId: String,
         userId: String,
         content: String,
         createdAt: Date = Date(),
         turnNumber: Int) {
        self.id = id
        self.sessionId = sessionId
        self.userId = userId
        self.content = content
        self.createdAt = createdAt
        self.turnNumber = turnNumber
    }
}
