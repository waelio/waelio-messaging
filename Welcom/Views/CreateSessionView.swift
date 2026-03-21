import SwiftUI
import CoreNFC
import Contacts
import ContactsUI

struct CreateSessionView: View {
    private enum Field: Hashable {
        case userName
    }

    @Environment(\.dismiss) var dismiss
    @StateObject private var nfcManager = NFCSessionManager()
    @State private var sessionTitle: String = ""
    @State private var userName: String = ""
    @State private var maxTurns: Int = 10
    @State private var turnDuration: TimeInterval = 120
    @State private var createdSession: Session?
    @State private var showingSession = false
    @State private var showingContactPicker = false
    @State private var showContactsDeniedAlert = false
    @FocusState private var focusedField: Field?
    
    var body: some View {
        NavigationView {
            Form {
                Section("Conversation Setup") {
                    TextField("Topic (e.g., Family Discussion)", text: $sessionTitle)
                    TextField("Your Name", text: $userName)
                        .focused($focusedField, equals: .userName)
                        .textInputAutocapitalization(.words)

                    Button {
                        openContactPicker()
                    } label: {
                        HStack(spacing: 10) {
                            Image(systemName: "person.crop.circle.badge.plus")
                                .foregroundColor(.blue)
                            Text("Choose from Contacts")
                            Spacer()
                        }
                    }
                    .buttonStyle(.plain)
                    
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
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
            }
            .sheet(isPresented: $showingContactPicker) {
                ContactPickerView { selectedName in
                    applySelectedContactName(selectedName)
                }
            }
            .alert("Contacts Access Needed", isPresented: $showContactsDeniedAlert) {
                Button("OK", role: .cancel) {}
            } message: {
                Text("Allow Contacts access in Settings to quickly fill your name.")
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

    private func applySelectedContactName(_ name: String) {
        focusedField = nil
        userName = name
    }

    private func openContactPicker() {
        focusedField = nil

        let status = CNContactStore.authorizationStatus(for: .contacts)
        switch status {
        case .authorized, .limited:
            showingContactPicker = true
        case .notDetermined:
            CNContactStore().requestAccess(for: .contacts) { granted, _ in
                DispatchQueue.main.async {
                    if granted {
                        showingContactPicker = true
                    } else {
                        showContactsDeniedAlert = true
                    }
                }
            }
        case .denied, .restricted:
            showContactsDeniedAlert = true
        @unknown default:
            showContactsDeniedAlert = true
        }
    }
}

private struct ContactPickerView: UIViewControllerRepresentable {
    let onSelect: (String) -> Void

    func makeUIViewController(context: Context) -> CNContactPickerViewController {
        let controller = CNContactPickerViewController()
        controller.delegate = context.coordinator
        controller.predicateForSelectionOfContact = NSPredicate(value: true)
        controller.displayedPropertyKeys = [CNContactGivenNameKey, CNContactFamilyNameKey, CNContactNicknameKey]
        return controller
    }

    func updateUIViewController(_ uiViewController: CNContactPickerViewController, context: Context) {}

    func makeCoordinator() -> Coordinator {
        Coordinator(onSelect: onSelect)
    }

    final class Coordinator: NSObject, CNContactPickerDelegate {
        let onSelect: (String) -> Void

        init(onSelect: @escaping (String) -> Void) {
            self.onSelect = onSelect
        }

        func contactPicker(_ picker: CNContactPickerViewController, didSelect contact: CNContact) {
            let fullName = "\(contact.givenName) \(contact.familyName)".trimmingCharacters(in: .whitespaces)
            let resolvedName = fullName.isEmpty ? contact.nickname.trimmingCharacters(in: .whitespaces) : fullName
            if !resolvedName.isEmpty {
                onSelect(resolvedName)
            }
        }
    }
}

#Preview {
    CreateSessionView()
}
