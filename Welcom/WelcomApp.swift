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
    @State private var showJoinSession = false
    
    var body: some Scene {
        WindowGroup {
            ContentView()
                .onOpenURL { url in
                    handleIncomingURL(url)
                }
                .sheet(isPresented: $showJoinSession) {
                    if let code = pendingSessionCode {
                        JoinSessionView(initialSessionCode: code)
                    }
                }
        }
    }
    
    private func handleIncomingURL(_ url: URL) {
        // Handle welcom://join/SESSIONCODE URLs
        if url.scheme == "welcom" && url.host == "join" {
            let sessionCode = url.pathComponents.last ?? ""
            if !sessionCode.isEmpty {
                pendingSessionCode = sessionCode.uppercased()
                showJoinSession = true
            }
        }
        // Handle web URLs with code parameter (e.g., https://github.com/waelio/welcom?code=S3LTFB)
        else if (url.scheme == "https" || url.scheme == "http") && url.query?.contains("code=") == true {
            let components = URLComponents(url: url, resolvingAgainstBaseURL: false)
            if let codeValue = components?.queryItems?.first(where: { $0.name == "code" })?.value {
                pendingSessionCode = codeValue.uppercased()
                showJoinSession = true
            }
        }
    }
}
