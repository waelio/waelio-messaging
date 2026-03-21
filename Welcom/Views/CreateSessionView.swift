import SwiftUI
import CoreNFC
import Contacts
import Combine

struct CreateSessionView: View {
    @Environment(\.dismiss) var dismiss
    @StateObject private var nfcManager = NFCSessionManager()
    @StateObject private var contactSuggestions = ContactSuggestionsStore()
    @State private var sessionTitle: String = ""
    @State private var userName: String = ""
    @State private var maxTurns: Int = 10
    @State private var turnDuration: TimeInterval = 120
    @State private var createdSession: Session?
    @State private var showingSession = false
    
    var body: some View {
        NavigationView {
            Form {
                Section("Conversation Setup") {
                    TextField("Topic (e.g., Family Discussion)", text: $sessionTitle)
                    TextField("Your Name", text: $userName)

                    if !filteredContactNames.isEmpty {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Suggested from Contacts")
                                .font(.caption)
                                .foregroundColor(.secondary)

                            ForEach(filteredContactNames, id: \.self) { name in
                                Button {
                                    userName = name
                                } label: {
                                    HStack(spacing: 8) {
                                        Image(systemName: "person.crop.circle")
                                            .foregroundColor(.blue)
                                        Text(name)
                                            .foregroundColor(.primary)
                                        Spacer()
                                    }
                                }
                                .buttonStyle(.plain)
                            }
                        }
                        .padding(.top, 4)
                    }
                    
                    Picker("Number of Turns", selection: $maxTurns) {
                        ForEach([5, 10, 15, 20], id: \.self) { turns in
                            Text("\(turns) turns each").tag(turns)
                        }
                    }
                    
                    Picker("Time Per Turn", selection: $turnDuration) {
                        Text("1 minute").tag(TimeInterval(60))
                        Text("2 minutes").tag(TimeInterval(120))
                        Text("3 minutes").tag(TimeInterval(180))
                        Text("5 minutes").tag(TimeInterval(300))
                    }
                }
                
                Section("How It Works") {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("• Both people get equal, timed turns to speak")
                            .font(.caption)
                            .foregroundColor(.secondary)
                        
                        Text("• Only one person can talk at a time - no interruptions")
                            .font(.caption)
                            .foregroundColor(.secondary)
                        
                        Text("• Share the code with the other person to begin")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }
                
                Section {
                    Button(action: createSession) {
                        HStack {
                            Spacer()
                            Text("Start Conversation")
                                .bold()
                            Spacer()
                        }
                    }
                    .disabled(sessionTitle.isEmpty || userName.isEmpty)
                }
            }
            .navigationTitle("Start a Conversation")
            .navigationBarTitleDisplayMode(.inline)
            .onAppear {
                contactSuggestions.requestAccessIfNeeded()
            }
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

    private var filteredContactNames: [String] {
        let typed = userName.trimmingCharacters(in: .whitespacesAndNewlines)
        if typed.isEmpty {
            return Array(contactSuggestions.names.prefix(4))
        }

        return contactSuggestions.names
            .filter { $0.localizedCaseInsensitiveContains(typed) }
            .prefix(6)
            .map { $0 }
    }
}

final class ContactSuggestionsStore: ObservableObject {
    @Published var names: [String] = []

    private let store = CNContactStore()
    private var hasRequested = false

    func requestAccessIfNeeded() {
        guard !hasRequested else { return }
        hasRequested = true

        let status = CNContactStore.authorizationStatus(for: .contacts)
        switch status {
        case .authorized:
            fetchNames()
        case .notDetermined:
            store.requestAccess(for: .contacts) { [weak self] granted, _ in
                if granted {
                    self?.fetchNames()
                }
            }
        case .denied, .restricted:
            break
        @unknown default:
            break
        }
    }

    private func fetchNames() {
        let keys: [CNKeyDescriptor] = [
            CNContactGivenNameKey as CNKeyDescriptor,
            CNContactFamilyNameKey as CNKeyDescriptor,
            CNContactNicknameKey as CNKeyDescriptor
        ]

        let request = CNContactFetchRequest(keysToFetch: keys)
        var found: [String] = []

        do {
            try store.enumerateContacts(with: request) { contact, _ in
                let fullName = "\(contact.givenName) \(contact.familyName)".trimmingCharacters(in: .whitespaces)
                let candidate = fullName.isEmpty ? contact.nickname.trimmingCharacters(in: .whitespaces) : fullName
                if !candidate.isEmpty {
                    found.append(candidate)
                }
            }

            let deduped = Array(Set(found)).sorted()
            DispatchQueue.main.async {
                self.names = deduped
            }
        } catch {
            DispatchQueue.main.async {
                self.names = []
            }
        }
    }
}

#Preview {
    CreateSessionView()
}
