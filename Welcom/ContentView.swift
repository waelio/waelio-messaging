//
//  ContentView.swift
//  Welcom
//
//  Created by waelio on 07/03/2026.
//

import SwiftUI

struct ContentView: View {
    @StateObject private var sessionViewModel = SessionViewModel()
    @State private var showingSession = false
    
    var body: some View {
        NavigationView {
            VStack(spacing: 30) {
                Image(systemName: "person.2.wave.2")
                    .font(.system(size: 80))
                    .foregroundColor(.blue)
                
                Text("Turn-Based Negotiation")
                    .font(.title)
                    .bold()
                
                Text("Professional negotiation sessions with turn-based speaking, private notes, and session logging")
                    .font(.subheadline)
                    .foregroundColor(.gray)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 40)
                
                VStack(spacing: 15) {
                    Button {
                        showingSession = true
                    } label: {
                        HStack {
                            Image(systemName: "play.circle.fill")
                            Text("Start Demo Session")
                        }
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(Color.blue)
                        .foregroundColor(.white)
                        .cornerRadius(12)
                    }
                    
                    Button {
                        // Join session functionality
                    } label: {
                        HStack {
                            Image(systemName: "rectangle.and.pencil.and.ellipsis")
                            Text("Join Session")
                        }
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(Color.gray.opacity(0.2))
                        .foregroundColor(.primary)
                        .cornerRadius(12)
                    }
                    
                    Button {
                        // Create session functionality
                    } label: {
                        HStack {
                            Image(systemName: "plus.circle")
                            Text("Create Session")
                        }
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(Color.gray.opacity(0.2))
                        .foregroundColor(.primary)
                        .cornerRadius(12)
                    }
                }
                .padding(.horizontal, 40)
            }
            .navigationTitle("Welcom")
            .fullScreenCover(isPresented: $showingSession) {
                NavigationStack {
                    SessionView(sessionViewModel: sessionViewModel)
                }
            }
        }
    }
}

// MARK: - Preview

#Preview {
    ContentView()
}
