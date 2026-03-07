import SwiftUI

struct SessionView: View {
    @ObservedObject var sessionViewModel: SessionViewModel
    @Environment(\.dismiss) var dismiss
    @State private var showingExportSheet = false
    @State private var showingModificationSheet = false
    @State private var exportedLogURL: URL?
    
    var body: some View {
        VStack(spacing: 0) {
            // Header
            sessionHeader
            
            // Main Content
            ScrollView {
                VStack(spacing: 20) {
                    // Timer Section
                    timerSection
                    
                    // Party Status
                    partyStatusSection
                    
                    // Notes Section
                    notesSection
                    
                    // Log Section
                    logSection
                }
                .padding()
            }
            
            // Bottom Controls
            bottomControls
        }
        .navigationBarHidden(true)
        .onAppear {
            sessionViewModel.startTimer()
        }
        .alert("Modification Request", isPresented: $showingModificationSheet) {
            modificationRequestAlert
        }
        .sheet(isPresented: $showingExportSheet) {
            if let url = exportedLogURL {
                ShareSheet(items: [url])
            }
        }
    }
    
    // MARK: - Header
    private var sessionHeader: some View {
        VStack(spacing: 8) {
            HStack {
                Text(sessionViewModel.session?.title ?? "Session")
                    .font(.headline)
                
                Spacer()
                
                // Session Code
                if let code = sessionViewModel.session?.sessionCode {
                    Text("Code: \(code)")
                        .font(.caption)
                        .padding(6)
                        .background(Color.gray.opacity(0.2))
                        .cornerRadius(6)
                }
                
                Button("Leave") {
                    sessionViewModel.endSession()
                    dismiss()
                }
                .foregroundColor(.red)
            }
            .padding(.horizontal)
            .padding(.top, 8)
            
            // Status Bar
            HStack {
                Circle()
                    .fill(statusColor)
                    .frame(width: 8, height: 8)
                Text(statusText)
                    .font(.caption)
                
                Spacer()
                
                if let myParty = sessionViewModel.myParty {
                    Text("You: \(myParty.displayName)")
                        .font(.caption)
                        .bold()
                }
            }
            .padding(.horizontal)
            .padding(.bottom, 8)
            
            Divider()
        }
        .background(Color(.systemBackground))
    }
    
    private var statusColor: Color {
        switch sessionViewModel.session?.status {
        case .active: return .green
        case .paused: return .orange
        case .waiting: return .yellow
        case .completed: return .gray
        case .none: return .gray
        }
    }
    
    private var statusText: String {
        switch sessionViewModel.session?.status {
        case .active: return "Active"
        case .paused: return "Paused"
        case .waiting: return "Waiting for participant"
        case .completed: return "Completed"
        case .none: return "Unknown"
        }
    }
    
    // MARK: - Timer Section
    private var timerSection: some View {
        VStack(spacing: 10) {
            ZStack {
                Circle()
                    .stroke(lineWidth: 15)
                    .opacity(0.3)
                    .foregroundColor(timerColor)
                
                Circle()
                    .trim(from: 0.0, to: progressValue)
                    .stroke(style: StrokeStyle(lineWidth: 15, lineCap: .round))
                    .foregroundColor(timerColor)
                    .rotationEffect(Angle(degrees: -90))
                
                VStack {
                    Text(timeString(from: sessionViewModel.timeRemaining))
                        .font(.system(size: 48, weight: .bold, design: .rounded))
                    
                    Text("remaining")
                        .font(.caption)
                        .foregroundColor(.gray)
                }
            }
            .frame(width: 200, height: 200)
            
            if let currentTurn = sessionViewModel.session?.currentTurnNumber {
                Text("Turn \(currentTurn) of \(sessionViewModel.session?.maxTurns ?? 10)")
                    .font(.headline)
            }
        }
    }
    
    private var timerColor: Color {
        if sessionViewModel.timeRemaining < 60 {
            return .red
        } else if sessionViewModel.timeRemaining < 120 {
            return .orange
        } else {
            return .blue
        }
    }
    
    private var progressValue: CGFloat {
        guard let session = sessionViewModel.session,
              session.turnDuration > 0 else { return 0 }
        return CGFloat(1 - (sessionViewModel.timeRemaining / session.turnDuration))
    }
    
    // MARK: - Party Status Section
    private var partyStatusSection: some View {
        HStack(spacing: 20) {
            partyStatusCard(
                party: .partyA,
                isActive: sessionViewModel.session?.currentTurn == .partyA,
                isMe: sessionViewModel.myParty == .partyA
            )
            
            partyStatusCard(
                party: .partyB,
                isActive: sessionViewModel.session?.currentTurn == .partyB,
                isMe: sessionViewModel.myParty == .partyB
            )
        }
    }
    
    private func partyStatusCard(party: Session.TurnParty, isActive: Bool, isMe: Bool) -> some View {
        VStack(spacing: 10) {
            Text(party.displayName)
                .font(.headline)
            
            Image(systemName: isActive ? "mic.fill" : "mic.slash.fill")
                .font(.system(size: 30))
                .foregroundColor(isActive ? .green : .red)
            
            if isMe {
                Text("You")
                    .font(.caption)
                    .padding(4)
                    .background(Color.blue.opacity(0.2))
                    .cornerRadius(4)
            }
        }
        .frame(maxWidth: .infinity)
        .padding()
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(isActive ? Color.green.opacity(0.1) : Color.gray.opacity(0.1))
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(isActive ? Color.green : Color.gray, lineWidth: 1)
                )
        )
    }
    
    // MARK: - Notes Section
    private var notesSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Label("Your Private Notes", systemImage: "note.text")
                    .font(.headline)
                
                Spacer()
                
                if !sessionViewModel.isMyTurn {
                    Text("(Opponent's turn)")
                        .font(.caption)
                        .foregroundColor(.orange)
                }
            }
            
            TextEditor(text: $sessionViewModel.currentNote)
                .frame(height: 100)
                .padding(4)
                .background(Color.gray.opacity(0.1))
                .cornerRadius(8)
                .disabled(sessionViewModel.isMyTurn) // Can only take notes when opponent is speaking
            
            HStack {
                Spacer()
                
                Button("Save Note") {
                    sessionViewModel.saveNote()
                }
                .disabled(sessionViewModel.currentNote.isEmpty || sessionViewModel.isMyTurn)
                .buttonStyle(.bordered)
            }
            
            // Recent notes
            if !sessionViewModel.notes.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack {
                        ForEach(sessionViewModel.notes.prefix(5)) { note in
                            notePreview(note)
                        }
                    }
                }
            }
        }
        .padding()
        .background(Color.gray.opacity(0.05))
        .cornerRadius(12)
    }
    
    private func notePreview(_ note: Note) -> some View {
        VStack(alignment: .leading) {
            Text(note.content)
                .lineLimit(2)
                .font(.caption)
                .frame(width: 150, alignment: .leading)
            
            Text(note.createdAt, style: .time)
                .font(.caption2)
                .foregroundColor(.gray)
        }
        .padding(8)
        .background(Color.white)
        .cornerRadius(8)
        .shadow(radius: 1)
    }
    
    // MARK: - Log Section
    private var logSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Label("Session Log", systemImage: "list.bullet")
                .font(.headline)
            
            if sessionViewModel.logEntries.isEmpty {
                Text("No log entries yet")
                    .font(.caption)
                    .foregroundColor(.gray)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding()
            } else {
                ForEach(sessionViewModel.logEntries.prefix(10)) { entry in
                    logEntryRow(entry)
                }
            }
        }
        .padding()
        .background(Color.gray.opacity(0.05))
        .cornerRadius(12)
    }
    
    private func logEntryRow(_ entry: LogEntry) -> some View {
        HStack(alignment: .top) {
            Circle()
                .fill(logTypeColor(entry.type))
                .frame(width: 8, height: 8)
                .padding(.top, 4)
            
            VStack(alignment: .leading, spacing: 2) {
                Text(entry.message)
                    .font(.subheadline)
                
                Text(entry.timestamp, style: .time)
                    .font(.caption2)
                    .foregroundColor(.gray)
            }
            
            Spacer()
        }
        .padding(.vertical, 4)
    }
    
    private func logTypeColor(_ type: LogEntry.LogType) -> Color {
        switch type {
        case .turnStarted: return .blue
        case .turnEnded: return .blue.opacity(0.5)
        case .modificationRequested: return .orange
        case .modificationApproved: return .green
        case .modificationDenied: return .red
        case .noteAdded: return .purple
        case .sessionStarted: return .green
        case .sessionEnded: return .red
        case .pause: return .orange
        case .resume: return .green
        default: return .gray
        }
    }
    
    // MARK: - Bottom Controls
    private var bottomControls: some View {
        VStack(spacing: 0) {
            Divider()
            
            HStack {
                // Mute indicator
                HStack {
                    Image(systemName: sessionViewModel.isMuted ? "mic.slash.fill" : "mic.fill")
                        .foregroundColor(sessionViewModel.isMuted ? .red : .green)
                    Text(sessionViewModel.isMuted ? "Muted" : "Active")
                        .font(.caption)
                }
                .padding(.horizontal)
                
                Spacer()
                
                // Pending requests indicator
                if !sessionViewModel.pendingRequests.isEmpty {
                    Button(action: { showingModificationSheet = true }) {
                        HStack {
                            Image(systemName: "exclamationmark.bubble.fill")
                            Text("\(sessionViewModel.pendingRequests.count) pending")
                                .font(.caption)
                        }
                        .padding(.horizontal, 10)
                        .padding(.vertical, 5)
                        .background(Color.orange)
                        .foregroundColor(.white)
                        .cornerRadius(15)
                    }
                }
                
                // Modification button
                Menu {
                    Button("Extend Turn (1 min)") {
                        sessionViewModel.requestModification(
                            type: .extendTurn,
                            reason: "Need more time"
                        )
                    }
                    
                    Button("Add Extra Turn") {
                        sessionViewModel.requestModification(
                            type: .addTurn,
                            reason: "Additional turn needed"
                        )
                    }
                    
                    Button("Pause Session") {
                        sessionViewModel.requestModification(
                            type: .pauseSession,
                            reason: "Brief pause requested"
                        )
                    }
                    
                    if sessionViewModel.session?.status == .paused {
                        Button("Resume Session") {
                            sessionViewModel.requestModification(
                                type: .resumeSession,
                                reason: "Resume negotiation"
                            )
                        }
                    }
                    
                    Button("End Session", role: .destructive) {
                        sessionViewModel.requestModification(
                            type: .endSession,
                            reason: "End negotiation"
                        )
                    }
                } label: {
                    Image(systemName: "ellipsis.circle")
                        .font(.title2)
                        .padding(.horizontal)
                }
                
                // Export button
                Button(action: {
                    if let url = sessionViewModel.exportLog() {
                        exportedLogURL = url
                        showingExportSheet = true
                    }
                }) {
                    Image(systemName: "square.and.arrow.up")
                        .font(.title2)
                        .padding(.horizontal)
                }
            }
            .padding(.vertical, 10)
            .background(Color(.systemBackground))
        }
    }
    
    // MARK: - Modification Request Alert
    private var modificationRequestAlert: some View {
        Group {
            if let request = sessionViewModel.pendingRequests.first {
                VStack {
                    Text("Modification Request")
                        .font(.headline)
                    
                    Text("Type: \(request.type.description)")
                    Text("Reason: \(request.reason)")
                    
                    HStack {
                        Button("Deny", role: .cancel) {
                            sessionViewModel.respondToRequest(request, approve: false)
                        }
                        
                        Button("Approve") {
                            sessionViewModel.respondToRequest(request, approve: true)
                        }
                    }
                }
            }
        }
    }
    
    // MARK: - Helpers
    private func timeString(from timeInterval: TimeInterval) -> String {
        let minutes = Int(timeInterval) / 60
        let seconds = Int(timeInterval) % 60
        return String(format: "%02d:%02d", minutes, seconds)
    }
}

// MARK: - Share Sheet
struct ShareSheet: UIViewControllerRepresentable {
    let items: [Any]
    
    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }
    
    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}