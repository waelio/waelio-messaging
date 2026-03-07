import SwiftUI
import CoreNFC

struct CreateSessionView: View {
    @Environment(\.dismiss) var dismiss
    @StateObject private var nfcManager = NFCSessionManager()
    @State private var sessionTitle: String = ""
    @State private var userName: String = ""
    @State private var maxTurns: Int = 10
    @State private var turnDuration: TimeInterval = 120
    @State private var createdSession: Session?
    @State private var showingSession = false
    
    var body: some View {
        NavigationView {
            Form {
                Section("Session Details") {
                    TextField("Session Title", text: $sessionTitle)
                    TextField("Your Name", text: $userName)
                    
                    Picker("Max Turns", selection: $maxTurns) {
                        ForEach([5, 10, 15, 20], id: \.self) { turns in
                            Text("\(turns) turns").tag(turns)
                        }
                    }
                    
                    Picker("Turn Duration", selection: $turnDuration) {
                        Text("1 minute").tag(TimeInterval(60))
                        Text("2 minutes").tag(TimeInterval(120))
                        Text("3 minutes").tag(TimeInterval(180))
                        Text("5 minutes").tag(TimeInterval(300))
                    }
                }
                
                Section("Instructions") {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Creating a new session will generate a unique code that others can use to join.")
                            .font(.caption)
                            .foregroundColor(.secondary)
                        
                        Text("Share the code with the other participant to begin the negotiation.")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }
                
                Section {
                    Button(action: createSession) {
                        HStack {
                            Spacer()
                            Text("Create Session")
                                .bold()
                            Spacer()
                        }
                    }
                    .disabled(sessionTitle.isEmpty || userName.isEmpty)
                }
            }
            .navigationTitle("Create Session")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
            }
            .fullScreenCover(isPresented: $showingSession) {
                if let session = createdSession {
                    NavigationStack {
                        SessionView(sessionViewModel: SessionViewModel(
                            session: session,
                            userId: session.partyAId,
                            userName: userName,
                            isHost: true
                        ))
                    }
                }
            }
        }
    }
    
    private func createSession() {
        let userId = UUID().uuidString
        let sessionCode = generateSessionCode()
        
        let session = Session(
            title: sessionTitle,
            sessionCode: sessionCode,
            status: .waiting,
            currentTurn: .partyA,
            currentTurnNumber: 1,
            maxTurns: maxTurns,
            turnDuration: turnDuration,
            partyAId: userId,
            partyBId: "",
            turnStartedAt: nil
        )
        
        createdSession = session
        showingSession = true
    }
    
    private func generateSessionCode() -> String {
        let letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
        return String((0..<6).map { _ in letters.randomElement()! })
    }
}

#Preview {
    CreateSessionView()
}
