import SwiftUI
import CoreNFC

struct WaitingRoomView: View {
    @ObservedObject var sessionViewModel: SessionViewModel
    @Environment(\.dismiss) var dismiss
    @StateObject private var nfcManager = NFCSessionManager()
    @State private var showingShareSheet = false
    
    var body: some View {
        VStack(spacing: 30) {
            Spacer()
            
            // Session Code Display
            VStack(spacing: 15) {
                Text("Session Code")
                    .font(.headline)
                    .foregroundColor(.secondary)
                
                // QR Code
                if let code = sessionViewModel.session?.sessionCode,
                   let qrImage = QRCodeGenerator.generateQRCode(from: code) {
                    Image(uiImage: qrImage)
                        .interpolation(.none)
                        .resizable()
                        .frame(width: 200, height: 200)
                        .padding()
                        .background(Color.white)
                        .clipShape(RoundedRectangle(cornerRadius: 16))
                        .shadow(radius: 5)
                }
                
                Text(sessionViewModel.session?.sessionCode ?? "")
                    .font(.system(size: 32, weight: .bold, design: .rounded))
                    .tracking(4)
                    .padding(.horizontal, 20)
                    .padding(.vertical, 12)
                    .background(
                        RoundedRectangle(cornerRadius: 12)
                            .fill(Color.blue.opacity(0.1))
                            .overlay(
                                RoundedRectangle(cornerRadius: 12)
                                    .stroke(Color.blue, lineWidth: 2)
                            )
                    )
                
                Button(action: { showingShareSheet = true }) {
                    HStack {
                        Image(systemName: "square.and.arrow.up")
                        Text("Share Code")
                    }
                    .padding(.horizontal, 20)
                    .padding(.vertical, 10)
                    .background(Color.blue)
                    .foregroundColor(.white)
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                }
                
                if NFCNDEFReaderSession.readingAvailable {
                    Button(action: {
                        if let code = sessionViewModel.session?.sessionCode {
                            nfcManager.startWriting(code: code)
                        }
                    }) {
                        HStack {
                            Image(systemName: nfcManager.isWriting ? "wave.3.right.circle.fill" : "wave.3.right")
                            Text(nfcManager.isWriting ? "Ready to tap..." : "Share via NFC")
                        }
                        .padding(.horizontal, 20)
                        .padding(.vertical, 10)
                        .background(Color.green)
                        .foregroundColor(.white)
                        .clipShape(RoundedRectangle(cornerRadius: 10))
                    }
                    .disabled(nfcManager.isWriting)
                }
            }
            
            Spacer()
            
            // Waiting indicator
            VStack(spacing: 15) {
                ProgressView()
                    .scaleEffect(1.5)
                
                Text("Waiting for participant to join...")
                    .font(.headline)
                    .foregroundColor(.secondary)
                
                Text("Share the code above with the other party")
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 40)
            }
            
            Spacer()
            
            // Session details
            VStack(alignment: .leading, spacing: 12) {
                DetailRow(icon: "person.fill", title: "Host", value: sessionViewModel.myParty?.displayName ?? "You")
                DetailRow(icon: "timer", title: "Turn Duration", value: timeString(from: sessionViewModel.session?.turnDuration ?? 120))
                DetailRow(icon: "arrow.left.arrow.right", title: "Max Turns", value: "\(sessionViewModel.session?.maxTurns ?? 10)")
            }
            .padding(20)
            .background(
                RoundedRectangle(cornerRadius: 12)
                    .fill(Color.gray.opacity(0.1))
            )
            .padding(.horizontal, 20)
            
            Spacer()
            
            Button("Cancel Session") {
                sessionViewModel.endSession()
                dismiss()
            }
            .foregroundColor(.red)
            .padding(.bottom, 10)
            
            // Demo: Simulate participant joining
            Button("Simulate Join (Demo)") {
                sessionViewModel.simulateParticipantJoin()
            }
            .font(.caption)
            .foregroundColor(.blue)
            .padding(.bottom, 20)
        }
        .navigationTitle(sessionViewModel.session?.title ?? "Session")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $showingShareSheet) {
            if let code = sessionViewModel.session?.sessionCode {
                ShareSheet(items: [
                    "Join my negotiation session with code: \(code)\n\nDownload Welcom to participate."
                ])
            }
        }
    }
    
    private func timeString(from timeInterval: TimeInterval) -> String {
        let minutes = Int(timeInterval) / 60
        return "\(minutes) min"
    }
}

struct DetailRow: View {
    let icon: String
    let title: String
    let value: String
    
    var body: some View {
        HStack {
            Image(systemName: icon)
                .foregroundColor(.blue)
                .frame(width: 24)
            
            Text(title)
                .foregroundColor(.secondary)
            
            Spacer()
            
            Text(value)
                .bold()
        }
    }
}

#Preview {
    NavigationStack {
        WaitingRoomView(sessionViewModel: SessionViewModel(
            session: Session(
                title: "Demo Session",
                sessionCode: "ABC123",
                status: .waiting,
                currentTurn: .partyA,
                currentTurnNumber: 1,
                maxTurns: 10,
                turnDuration: 120,
                partyAId: "user1",
                partyBId: "",
                turnStartedAt: nil
            ),
            userId: "user1",
            userName: "Host User",
            isHost: true
        ))
    }
}
