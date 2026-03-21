import Foundation

struct SessionRating: Codable, Identifiable {
    let id: String
    let sessionId: String
    let userId: String
    let overallRating: Int // 1-5 stars
    let respectfulnessRating: Int // 1-5 stars
    let agreementReached: Bool
    let wouldNegotiateAgain: Bool
    let feedback: String?
    let createdAt: Date
    
    init(
        id: String = UUID().uuidString,
        sessionId: String,
        userId: String,
        overallRating: Int,
        respectfulnessRating: Int,
        agreementReached: Bool,
        wouldNegotiateAgain: Bool,
        feedback: String? = nil,
        createdAt: Date = Date()
    ) {
        self.id = id
        self.sessionId = sessionId
        self.userId = userId
        self.overallRating = overallRating
        self.respectfulnessRating = respectfulnessRating
        self.agreementReached = agreementReached
        self.wouldNegotiateAgain = wouldNegotiateAgain
        self.feedback = feedback
        self.createdAt = createdAt
    }
}
