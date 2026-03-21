//
//  WelcomApp.swift
//  Welcom
//
//  Created by waelio on 07/03/2026.
//

import SwiftUI

@main
struct WelcomApp: App {
    @State private var pendingSessionCode: String?
    @State private var pendingSenderName: String?
    @State private var showJoinSession = false
    
    var body: some Scene {
        WindowGroup {
            ContentView()
                .onOpenURL { url in
                    handleIncomingURL(url)
                }
                .sheet(isPresented: $showJoinSession) {
                    if let code = pendingSessionCode {
                        JoinSessionView(initialSessionCode: code, initialSenderName: pendingSenderName)
                    }
                }
        }
    }
    
    private func handleIncomingURL(_ url: URL) {
        guard let components = URLComponents(url: url, resolvingAgainstBaseURL: false) else { return }

        // Supports:
        // - welcom://join/SESSIONCODE
        // - welcom://join/SESSIONCODE?sender=...&receiver=...
        // - https://waelio-messaging.onrender.com/messaging?code=SESSIONCODE&sender=...&receiver=...
        if let code = extractSessionCode(from: url, components: components), !code.isEmpty {
            pendingSessionCode = code.uppercased()
            pendingSenderName = components.queryItems?.first(where: { $0.name == "senderName" })?.value
            showJoinSession = true
        }
    }

    private func extractSessionCode(from url: URL, components: URLComponents) -> String? {
        if let codeFromQuery = components.queryItems?.first(where: { $0.name == "code" })?.value,
           !codeFromQuery.isEmpty {
            return codeFromQuery
        }

        if url.scheme == "welcom" && url.host == "join" {
            let pathCode = url.path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
            return pathCode.isEmpty ? nil : pathCode
        }

        let pathParts = url.pathComponents.filter { $0 != "/" }
        if let last = pathParts.last, last.lowercased() != "messaging", !last.isEmpty {
            return last
        }

        return nil
    }
}
