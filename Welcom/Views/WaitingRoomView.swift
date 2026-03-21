import SwiftUI
import CoreNFC

struct WaitingRoomView: View {
    @ObservedObject var sessionViewModel: SessionViewModel
    @Environment(\.dismiss) var dismiss
    @StateObject private var nfcManager = NFCSessionManager()
    @State private var shareMessage = ""
    @State private var animateIn = false
    @State private var pulseCode = false
    @State private var breatheSpinner = false
    
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
                    .scaleEffect(pulseCode ? 1.02 : 1.0)
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
                    .scaleEffect(pulseCode ? 1.01 : 1.0)
                
                ShareLink(item: shareMessage.isEmpty ? fallbackShareMessage : shareMessage) {
                    HStack {
                        Image(systemName: "square.and.arrow.up")
                        Text("Share via AirDrop")
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
            .opacity(animateIn ? 1 : 0)
            .offset(y: animateIn ? 0 : 16)
            .animation(.spring(response: 0.45, dampingFraction: 0.86), value: animateIn)
            
            Spacer()
            
            // Waiting indicator
            VStack(spacing: 15) {
                ProgressView()
                    .scaleEffect(breatheSpinner ? 1.58 : 1.42)
                    .animation(.easeInOut(duration: 1.0).repeatForever(autoreverses: true), value: breatheSpinner)
                
                Text("Waiting for other person...")
                    .font(.headline)
                    .foregroundColor(.secondary)
                
                Text("AirDrop the code, share QR, or send the session code")
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 40)
            }
                    .opacity(animateIn ? 1 : 0)
                    .offset(y: animateIn ? 0 : 20)
                    .animation(.spring(response: 0.5, dampingFraction: 0.86).delay(0.08), value: animateIn)
            
            Spacer()
            
            // Session details
            VStack(alignment: .leading, spacing: 12) {
                DetailRow(icon: "person.fill", title: "Started by", value: sessionViewModel.myParty?.displayName ?? "You")
                DetailRow(icon: "timer", title: "Time per turn", value: timeString(from: sessionViewModel.session?.turnDuration ?? 120))
                DetailRow(icon: "arrow.left.arrow.right", title: "Total turns", value: "\(sessionViewModel.session?.maxTurns ?? 10) each")
            }
            .padding(20)
            .background(
                RoundedRectangle(cornerRadius: 12)
                    .fill(Color.gray.opacity(0.1))
            )
            .padding(.horizontal, 20)
            .opacity(animateIn ? 1 : 0)
            .offset(y: animateIn ? 0 : 24)
            .animation(.spring(response: 0.55, dampingFraction: 0.88).delay(0.14), value: animateIn)
            
            Spacer()
            
            Button("Cancel") {
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
        .onAppear {
            animateIn = true
            pulseCode = true
            breatheSpinner = true
            rebuildShareMessage()
        }
        .onChange(of: sessionViewModel.session?.sessionCode) { _ in
            rebuildShareMessage()
        }
        .onChange(of: sessionViewModel.currentUserName) { _ in
            rebuildShareMessage()
        }
    }
    
    private func timeString(from timeInterval: TimeInterval) -> String {
        let minutes = Int(timeInterval) / 60
        return "\(minutes) min"
    }

    private func appJoinLink(for code: String) -> String {
        var components = URLComponents()
        components.scheme = "welcom"
        components.host = "join"
        components.path = "/\(code)"
        components.queryItems = shareQueryItems(for: code)
        return components.url?.absoluteString ?? "welcom://join/\(code)"
    }

    private func webJoinLink(for code: String) -> String {
        var components = URLComponents()
        components.scheme = "https"
        components.host = "waelio-messaging.onrender.com"
        components.path = "/messaging"
        let appLink = appJoinLink(for: code)
        components.queryItems = shareQueryItems(for: code) + [
            URLQueryItem(name: "app_link", value: appLink),
            URLQueryItem(name: "deeplink", value: appLink)
        ]
        return components.url?.absoluteString ?? "https://waelio-messaging.onrender.com/messaging?code=\(code)"
    }

    private func shareQueryItems(for code: String) -> [URLQueryItem] {
        let senderId = sessionViewModel.currentUserId
        let senderName = sessionViewModel.currentUserName
        let receiverId = sessionViewModel.session?.partyBId.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""

        var items: [URLQueryItem] = [
            URLQueryItem(name: "code", value: code),
            URLQueryItem(name: "sender", value: senderId),
            URLQueryItem(name: "senderName", value: senderName)
        ]

        if !receiverId.isEmpty {
            items.append(URLQueryItem(name: "receiver", value: receiverId))
        }

        return items
    }

    private var fallbackShareMessage: String {
        "Join my Welcom conversation 👋"
    }

    private func rebuildShareMessage() {
        guard let code = sessionViewModel.session?.sessionCode, !code.isEmpty else {
            shareMessage = fallbackShareMessage
            return
        }

        shareMessage = """
        Join my Welcom conversation 👋

        Open in browser:
        \(webJoinLink(for: code))

        Then tap “Open in App”.

        Direct app link:
        \(appJoinLink(for: code))

        Code: \(code)
        """
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
                maxTurns: 1,
                turnDuration: 60,
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
