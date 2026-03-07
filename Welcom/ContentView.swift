//
//  ContentView.swift
//  Welcom
//
//  Created by waelio on 07/03/2026.
//

import SwiftUI

struct ContentView: View {
    @State private var showingCreateSession = false
    @State private var showingJoinSession = false
    @State private var showingDemoSession = false
    @State private var showingShareApp = false
    @StateObject private var demoViewModel = SessionViewModel()
    
    var body: some View {
        NavigationView {
            VStack(spacing: 30) {
                Image(systemName: "bubble.left.and.bubble.right")
                    .font(.system(size: 80))
                    .foregroundColor(.blue)
                
                Text("Safe Communication")
                    .font(.title)
                    .bold()
                
                Text("Facilitate respectful, turn-based conversations. One person speaks at a time, preventing interruptions and promoting understanding.")
                    .font(.subheadline)
                    .foregroundColor(.gray)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 40)
                
                VStack(spacing: 15) {
                    Button {
                        showingCreateSession = true
                    } label: {
                        HStack {
                            Image(systemName: "plus.circle.fill")
                            Text("Start Conversation")
                        }
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(Color.blue)
                        .foregroundColor(.white)
                        .cornerRadius(12)
                    }
                    
                    Button {
                        showingJoinSession = true
                    } label: {
                        HStack {
                            Image(systemName: "person.badge.plus")
                            Text("Join Conversation")
                        }
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(Color.green)
                        .foregroundColor(.white)
                        .cornerRadius(12)
                    }
                    
                    Divider()
                        .padding(.vertical, 10)
                    
                    Button {
                        showingDemoSession = true
                    } label: {
                        HStack {
                            Image(systemName: "play.circle")
                            Text("Try Demo")
                        }
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(Color.gray.opacity(0.2))
                        .foregroundColor(.primary)
                        .cornerRadius(12)
                    }
                }
                .padding(.horizontal, 40)
                
                Spacer()
                
                VStack(spacing: 8) {
                    HStack(spacing: 20) {
                        FeatureLabel(icon: "timer", text: "Turn Timer")
                        FeatureLabel(icon: "note.text", text: "Private Notes")
                        FeatureLabel(icon: "list.bullet", text: "Session Log")
                    }
                }
                .font(.caption)
                .foregroundColor(.secondary)
                .padding(.bottom, 20)
            }
            .navigationTitle("Welcom")
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(action: { showingShareApp = true }) {
                        Image(systemName: "square.and.arrow.up")
                    }
                }
            }
            .sheet(isPresented: $showingCreateSession) {
                CreateSessionView()
            }
            .sheet(isPresented: $showingJoinSession) {
                JoinSessionView()
            }
            .fullScreenCover(isPresented: $showingDemoSession) {
                NavigationStack {
                    SessionView(sessionViewModel: demoViewModel)
                }
            }
            .sheet(isPresented: $showingShareApp) {
                ShareSheet(items: [
                    "Try Welcom - Safe Communication for Difficult Conversations\n\nWelcom helps people have respectful conversations by enforcing turn-based speaking. One person talks at a time, preventing interruptions and promoting understanding.\n\nPerfect for: couples therapy, family discussions, workplace conflicts, or any conversation that needs structure.\n\nDownload: https://github.com/waelio/welcom"
                ])
            }
        }
    }
}

struct FeatureLabel: View {
    let icon: String
    let text: String
    
    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: icon)
            Text(text)
        }
    }
}

// MARK: - Preview

#Preview {
    ContentView()
}
