import Foundation

struct User: Identifiable, Codable {
    let id: String
    let displayName: String
    let joinedAt: Date
    
    init(id: String = UUID().uuidString,
         displayName: String,
         joinedAt: Date = Date()) {
        self.id = id
        self.displayName = displayName
        self.joinedAt = joinedAt
    }
}
