import Foundation
import Combine

class SessionViewModel: ObservableObject {
    @Published var session: Session?
    @Published var timeRemaining: TimeInterval = 120
    @Published var currentNote: String = ""
    @Published var notes: [Note] = []
    @Published var logEntries: [LogEntry] = []
    @Published var pendingRequests: [ModificationRequest] = []
    @Published var isMuted: Bool = true
    @Published var isLoading: Bool = false
    @Published var errorMessage: String?
    
    var myParty: Session.TurnParty?
    private let currentUserId: String
    private var timer: Timer?
    private var cancellables = Set<AnyCancellable>()
    
    var isMyTurn: Bool {
        guard let session = session, let myParty = myParty else { return false }
        return session.currentTurn == myParty
    }
    
    init(sessionId: String? = nil, userId: String = "user-\(UUID().uuidString)") {
        self.currentUserId = userId
        
        // For demo: create a mock session
        if sessionId == nil {
            createMockSession()
        }
    }
    
    // MARK: - Session Management
    
    func startTimer() {
        timer?.invalidate()
        timer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] _ in
            guard let self = self else { return }
            
            if self.timeRemaining > 0 {
                self.timeRemaining -= 1
            } else {
                self.handleTurnEnd()
            }
            
            // Auto-mute logic
            self.updateMuteStatus()
        }
    }
    
    func endSession() {
        timer?.invalidate()
        addLogEntry(type: .sessionEnded, message: "Session ended by user")
    }
    
    private func handleTurnEnd() {
        guard var session = session else { return }
        
        addLogEntry(type: .turnEnded, message: "\(session.currentTurn.displayName) turn ended")
        
        // Switch turns
        session.currentTurn = session.currentTurn == .partyA ? .partyB : .partyA
        session.currentTurnNumber += 1
        session.turnStartedAt = Date()
        
        if session.currentTurnNumber > session.maxTurns {
            session.status = .completed
            addLogEntry(type: .sessionEnded, message: "Session completed - max turns reached")
        } else {
            addLogEntry(type: .turnStarted, message: "\(session.currentTurn.displayName) turn started")
            timeRemaining = session.turnDuration
        }
        
        self.session = session
    }
    
    private func updateMuteStatus() {
        isMuted = !isMyTurn
    }
    
    // MARK: - Notes
    
    func saveNote() {
        guard let session = session, !currentNote.isEmpty else { return }
        
        let note = Note(
            sessionId: session.id,
            userId: currentUserId,
            content: currentNote,
            turnNumber: session.currentTurnNumber
        )
        
        notes.insert(note, at: 0)
        addLogEntry(type: .noteAdded, message: "Note added")
        currentNote = ""
    }
    
    // MARK: - Modification Requests
    
    func requestModification(type: ModificationRequest.ModificationType, reason: String) {
        guard let session = session else { return }
        
        let request = ModificationRequest(
            sessionId: session.id,
            requestingUserId: currentUserId,
            type: type,
            reason: reason
        )
        
        pendingRequests.append(request)
        addLogEntry(type: .modificationRequested, message: "Modification requested: \(type.description)")
    }
    
    func respondToRequest(_ request: ModificationRequest, approve: Bool) {
        guard let index = pendingRequests.firstIndex(where: { $0.id == request.id }) else { return }
        
        var updatedRequest = request
        updatedRequest.status = approve ? .approved : .denied
        updatedRequest.respondedAt = Date()
        
        pendingRequests.remove(at: index)
        
        if approve {
            applyModification(request.type)
            addLogEntry(type: .modificationApproved, message: "Approved: \(request.type.description)")
        } else {
            addLogEntry(type: .modificationDenied, message: "Denied: \(request.type.description)")
        }
    }
    
    private func applyModification(_ type: ModificationRequest.ModificationType) {
        guard var session = session else { return }
        
        switch type {
        case .extendTurn:
            timeRemaining += 60
        case .addTurn:
            session.maxTurns += 1
        case .pauseSession:
            session.status = .paused
            timer?.invalidate()
            addLogEntry(type: .pause, message: "Session paused")
        case .resumeSession:
            session.status = .active
            startTimer()
            addLogEntry(type: .resume, message: "Session resumed")
        case .endSession:
            session.status = .completed
            timer?.invalidate()
            addLogEntry(type: .sessionEnded, message: "Session ended by mutual agreement")
        }
        
        self.session = session
    }
    
    // MARK: - Logging
    
    private func addLogEntry(type: LogEntry.LogType, message: String) {
        guard let session = session else { return }
        
        let entry = LogEntry(
            sessionId: session.id,
            type: type,
            message: message
        )
        
        logEntries.insert(entry, at: 0)
    }
    
    func exportLog() -> URL? {
        let logText = logEntries.map { entry in
            "[\(entry.timestamp)] \(entry.type.rawValue): \(entry.message)"
        }.joined(separator: "\n")
        
        let tempDir = FileManager.default.temporaryDirectory
        let fileName = "session_log_\(Date().timeIntervalSince1970).txt"
        let fileURL = tempDir.appendingPathComponent(fileName)
        
        do {
            try logText.write(to: fileURL, atomically: true, encoding: .utf8)
            return fileURL
        } catch {
            errorMessage = "Failed to export log: \(error.localizedDescription)"
            return nil
        }
    }
    
    // MARK: - Mock Data
    
    private func createMockSession() {
        let session = Session(
            title: "Demo Negotiation",
            sessionCode: "DEMO\(Int.random(in: 1000...9999))",
            status: .active,
            currentTurn: .partyA,
            currentTurnNumber: 1,
            maxTurns: 10,
            turnDuration: 120,
            partyAId: currentUserId,
            partyBId: "user-other",
            turnStartedAt: Date()
        )
        
        self.session = session
        self.myParty = .partyA
        self.timeRemaining = session.turnDuration
        
        addLogEntry(type: .sessionStarted, message: "Demo session started")
        addLogEntry(type: .turnStarted, message: "\(session.currentTurn.displayName) turn started")
        
        updateMuteStatus()
    }
}
