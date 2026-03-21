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
    @State private var pendingJoinMessage: String?
    @State private var showJoinSession = false
    
    var body: some Scene {
        WindowGroup {
            ContentView()
                .onOpenURL { url in
                    Task { @MainActor in
                        handleIncomingURL(url)
                    }
                }
                .sheet(isPresented: $showJoinSession) {
                    JoinSessionView(
                        initialSessionCode: pendingSessionCode,
                        initialSenderName: pendingSenderName,
                        initialLinkMessage: pendingJoinMessage
                    )
                }
        }
    }
    
    private func handleIncomingURL(_ url: URL) {
        guard let components = URLComponents(url: url, resolvingAgainstBaseURL: false) else { return }

        // Supports:
        // - welcom://join/SESSIONCODE
        // - welcom://join/SESSIONCODE?sender=...&receiver=...
        // - https://waelio-messaging.onrender.com/messaging?code=SESSIONCODE&sender=...&receiver=...
        pendingSenderName = extractSenderName(from: url, components: components)

        if let code = extractSessionCode(from: url, components: components), !code.isEmpty {
            pendingSessionCode = code.uppercased()
            pendingJoinMessage = nil
            showJoinSession = true
        } else {
            pendingSessionCode = nil
            pendingJoinMessage = "This invite link is missing a session code. Ask the sender to share the invitation again."
            showJoinSession = true
        }
    }

    private func extractSessionCode(from url: URL, components: URLComponents) -> String? {
        if let codeFromQuery = components.queryItems?.first(where: { $0.name == "code" })?.value,
           !codeFromQuery.isEmpty {
            return codeFromQuery
        }

        // Intermediary links may embed the app link as a query item
        for nestedKey in ["deeplink", "app_link", "link"] {
            if let nestedValue = components.queryItems?.first(where: { $0.name == nestedKey })?.value,
               let nestedURL = URL(string: nestedValue),
               let nestedComponents = URLComponents(url: nestedURL, resolvingAgainstBaseURL: false),
               let nestedCode = extractSessionCode(from: nestedURL, components: nestedComponents),
               !nestedCode.isEmpty {
                return nestedCode
            }
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

    private func extractSenderName(from url: URL, components: URLComponents) -> String? {
        if let sender = components.queryItems?.first(where: { $0.name == "senderName" })?.value,
           !sender.isEmpty {
            return sender
        }

        for nestedKey in ["deeplink", "app_link", "link"] {
            if let nestedValue = components.queryItems?.first(where: { $0.name == nestedKey })?.value,
               let nestedURL = URL(string: nestedValue),
               let nestedComponents = URLComponents(url: nestedURL, resolvingAgainstBaseURL: false),
               let nestedSender = extractSenderName(from: nestedURL, components: nestedComponents),
               !nestedSender.isEmpty {
                return nestedSender
            }
        }

        return nil
    }
}
