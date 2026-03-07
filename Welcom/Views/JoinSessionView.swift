import SwiftUI
import CoreNFC

struct JoinSessionView: View {
    @Environment(\.dismiss) var dismiss
    @StateObject private var nfcManager = NFCSessionManager()
    @State private var sessionCode: String = ""
    @State private var userName: String = ""
    @State private var isJoining = false
    @State private var errorMessage: String?
    @State private var joinedSession: Session?
    @State private var showingSession = false
    @State private var showingQRScanner = false
    @State private var scannedCode: String?
    
    var body: some View {
        NavigationView {
            Form {
                Section("Your Details") {
                    TextField("Your Name", text: $userName)
                    
                    HStack {
                        TextField("Session Code", text: $sessionCode)
                            .textInputAutocapitalization(.characters)
                            .autocorrectionDisabled()
                            .onChange(of: sessionCode) { oldValue, newValue in
                                sessionCode = newValue.uppercased()
                            }
                        
                        if NFCNDEFReaderSession.readingAvailable {
                            Button(action: {
                                nfcManager.startReading()
                            }) {
                                Image(systemName: nfcManager.isReading ? "wave.3.right.circle.fill" : "wave.3.right.circle")
                                    .font(.title2)
                                    .foregroundColor(.blue)
                            }
                            .disabled(nfcManager.isReading)
                        }
                    }
                }
                
                if let error = errorMessage ?? nfcManager.errorMessage {
                    Section {
                        Text(error)
                            .foregroundColor(.red)
                            .font(.caption)
                    }
                }
                
                Section {
                    Button(action: {
                        showingQRScanner = true
                    }) {
                        HStack {
                            Spacer()
                            Image(systemName: "qrcode.viewfinder")
                            Text("Scan QR Code")
                                .bold()
                            Spacer()
                        }
                    }
                } header: {
                    Text("Quick Join")
                } footer: {
                    Text("Scan the QR code shown in the host's waiting room")
                        .font(.caption)
                }
                
                if NFCNDEFReaderSession.readingAvailable {
                    Section {
                        Button(action: {
                            nfcManager.startReading()
                        }) {
                            HStack {
                                Spacer()
                                Image(systemName: "wave.3.right")
                                Text(nfcManager.isReading ? "Scanning..." : "Scan with NFC")
                                    .bold()
                                Spacer()
                            }
                        }
                        .disabled(nfcManager.isReading)
                    } header: {
                        Text("NFC")
                    } footer: {
                        Text("Tap your iPhone to another device to read the session code")
                            .font(.caption)
                    }
                }
                
                Section("Instructions") {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("• Scan QR code from host's screen (recommended)")
                            .font(.caption)
                            .foregroundColor(.secondary)
                        
                        Text("• Or enter the 6-character code manually")
                            .font(.caption)
                            .foregroundColor(.secondary)
                        
                        if NFCNDEFReaderSession.readingAvailable {
                            Text("• Or tap phones together via NFC")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                    }
                }
                
                Section {
                    Button(action: joinSession) {
                        HStack {
                            Spacer()
                            if isJoining {
                                ProgressView()
                                    .padding(.trailing, 8)
                            }
                            Text(isJoining ? "Joining..." : "Join Session")
                                .bold()
                            Spacer()
                        }
                    }
                    .disabled(sessionCode.count != 6 || userName.isEmpty || isJoining)
                }
            }
            .navigationTitle("Join Session")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
            }
            .onChange(of: nfcManager.sessionCode) { oldValue, newValue in
                if let code = newValue {
                    sessionCode = code
                }
            }
            .onChange(of: scannedCode) { oldValue, newValue in
                if let code = newValue {
                    sessionCode = code
                }
            }
            .sheet(isPresented: $showingQRScanner) {
                QRCodeScannerView(scannedCode: $scannedCode)
            }
            .fullScreenCover(isPresented: $showingSession) {
                if let session = joinedSession {
                    NavigationStack {
                        SessionView(sessionViewModel: SessionViewModel(
                            session: session,
                            userId: session.partyBId,
                            userName: userName,
                            isHost: false
                        ))
                    }
                }
            }
        }
    }
    
    private func joinSession() {
        isJoining = true
        errorMessage = nil
        
        // Simulate network delay
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
            // In a real app, this would query Firebase/backend for the session
            // For now, create a mock session
            let userId = UUID().uuidString
            
            let session = Session(
                title: "Negotiation Session",
                sessionCode: sessionCode,
                status: .active,
                currentTurn: .partyA,
                currentTurnNumber: 1,
                maxTurns: 10,
                turnDuration: 120,
                partyAId: "host-user-id",
                partyBId: userId,
                turnStartedAt: Date()
            )
            
            joinedSession = session
            isJoining = false
            showingSession = true
        }
    }
}

#Preview {
    JoinSessionView()
}
