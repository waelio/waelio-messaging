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
    @State private var pendingParseDebugInfo: String?
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
                        initialLinkMessage: pendingJoinMessage,
                        initialParseDebugInfo: pendingParseDebugInfo
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

        let extraction = extractSessionCode(from: url, components: components)

        if let code = extraction.code, !code.isEmpty {
            pendingSessionCode = code.uppercased()
            pendingJoinMessage = nil
            pendingParseDebugInfo = buildParseDebugInfo(url: url, source: extraction.source, code: code)
            showJoinSession = true
        } else {
            pendingSessionCode = nil
            pendingJoinMessage = "This invite link is missing a session code. Ask the sender to share the invitation again."
            pendingParseDebugInfo = buildParseDebugInfo(url: url, source: extraction.source, code: nil)
            showJoinSession = true
        }
    }

    private func extractSessionCode(from url: URL, components: URLComponents) -> (code: String?, source: String) {
        if let codeFromQuery = components.queryItems?.first(where: { $0.name == "code" })?.value,
           !codeFromQuery.isEmpty {
            return (codeFromQuery, "query:code")
        }

        // Intermediary links may embed the app link as a query item
        for nestedKey in ["deeplink", "app_link", "link"] {
            if let nestedValue = components.queryItems?.first(where: { $0.name == nestedKey })?.value,
               let nestedURL = URL(string: nestedValue),
               let nestedComponents = URLComponents(url: nestedURL, resolvingAgainstBaseURL: false) {
                let nestedResult = extractSessionCode(from: nestedURL, components: nestedComponents)
                if let nestedCode = nestedResult.code, !nestedCode.isEmpty {
                    return (nestedCode, "nested:\(nestedKey) -> \(nestedResult.source)")
                }
            }
        }

        if url.scheme == "welcom" && url.host == "join" {
            let pathCode = url.path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
            return pathCode.isEmpty ? (nil, "welcom-path(empty)") : (pathCode, "welcom-path")
        }

        let pathParts = url.pathComponents.filter { $0 != "/" }
        if let last = pathParts.last, last.lowercased() != "messaging", !last.isEmpty {
            return (last, "url-path-tail")
        }

        return (fallbackSessionCode(from: url.absoluteString), "fallback-regex")
    }

    private func fallbackSessionCode(from raw: String) -> String? {
        let patterns = [
            "(?:[?&]code=)([A-Za-z0-9]{4,12})",
            "(?:join/)([A-Za-z0-9]{4,12})",
            "(?:\\bcode\\b|\\bode\\b)\\s*[:=]\\s*([A-Za-z0-9]{4,12})"
        ]

        for pattern in patterns {
            if let match = firstCapture(in: raw, pattern: pattern) {
                return match
            }
        }

        return nil
    }

    private func extractSenderName(from url: URL, components: URLComponents) -> String? {
        if let sender = components.queryItems?.first(where: { $0.name == "senderName" })?.value,
           !sender.isEmpty {
            return normalizeText(sender)
        }

        for nestedKey in ["deeplink", "app_link", "link"] {
            if let nestedValue = components.queryItems?.first(where: { $0.name == nestedKey })?.value,
               let nestedURL = URL(string: nestedValue),
               let nestedComponents = URLComponents(url: nestedURL, resolvingAgainstBaseURL: false),
               let nestedSender = extractSenderName(from: nestedURL, components: nestedComponents),
               !nestedSender.isEmpty {
                return normalizeText(nestedSender)
            }
        }

        return nil
    }

    private func firstCapture(in text: String, pattern: String) -> String? {
        guard let regex = try? NSRegularExpression(pattern: pattern, options: [.caseInsensitive]) else {
            return nil
        }

        let nsRange = NSRange(text.startIndex..<text.endIndex, in: text)
        guard let match = regex.firstMatch(in: text, options: [], range: nsRange),
              match.numberOfRanges > 1,
              let range = Range(match.range(at: 1), in: text) else {
            return nil
        }

        return String(text[range])
    }

    private func normalizeText(_ input: String) -> String {
        var value = input
        for _ in 0..<2 {
            if let decoded = value.removingPercentEncoding, decoded != value {
                value = decoded
            } else {
                break
            }
        }
        return value.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private func buildParseDebugInfo(url: URL, source: String, code: String?) -> String {
        let shortRaw = String(url.absoluteString.prefix(380))
        return """
        Parsed code: \(code ?? "<none>")
        Source: \(source)
        Raw link: \(shortRaw)
        """
    }
}
