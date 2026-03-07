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
    @StateObject private var demoViewModel = SessionViewModel()
    
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
                        showingCreateSession = true
                    } label: {
                        HStack {
                            Image(systemName: "plus.circle.fill")
                            Text("Create Session")
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
                            Image(systemName: "rectangle.and.pencil.and.ellipsis")
                            Text("Join Session")
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
