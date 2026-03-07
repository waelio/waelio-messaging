//
//  WelcomApp.swift
//  Welcom
//
//  Created by waelio on 07/03/2026.
//

import SwiftUI
import CoreData

@main
struct WelcomApp: App {
    let persistenceController = PersistenceController.shared

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environment(\.managedObjectContext, persistenceController.container.viewContext)
        }
    }
}
