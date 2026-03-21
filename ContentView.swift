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
    @State private var animateIn = false
    @StateObject private var demoViewModel = SessionViewModel()
    
    var body: some View {
        NavigationView {
            VStack(spacing: 30) {
                BrandIconView()
                    .scaleEffect(animateIn ? 1 : 0.9)
                    .opacity(animateIn ? 1 : 0)
                    .animation(.spring(response: 0.7, dampingFraction: 0.75), value: animateIn)
                
                Text("Safe Communication")
                    .font(.title)
                    .bold()
                    .opacity(animateIn ? 1 : 0)
                    .offset(y: animateIn ? 0 : 12)
                    .animation(.easeOut(duration: 0.35).delay(0.1), value: animateIn)
                
                Text("Facilitate respectful, turn-based conversations. One person speaks at a time, preventing interruptions and promoting understanding.")
                    .font(.subheadline)
                    .foregroundColor(.gray)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 40)
                    .opacity(animateIn ? 1 : 0)
                    .offset(y: animateIn ? 0 : 14)
                    .animation(.easeOut(duration: 0.4).delay(0.18), value: animateIn)
                
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
                    .buttonStyle(PressableScaleButtonStyle())
                    
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
                    .buttonStyle(PressableScaleButtonStyle())
                    
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
                    .buttonStyle(PressableScaleButtonStyle())
                }
                .padding(.horizontal, 40)
                .opacity(animateIn ? 1 : 0)
                .offset(y: animateIn ? 0 : 18)
                .animation(.spring(response: 0.65, dampingFraction: 0.8).delay(0.25), value: animateIn)
                
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
                .opacity(animateIn ? 1 : 0)
                .offset(y: animateIn ? 0 : 10)
                .animation(.easeOut(duration: 0.45).delay(0.35), value: animateIn)
            }
            .navigationTitle("WelcomTalk")
            .onAppear {
                animateIn = true
            }
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

struct PressableScaleButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.98 : 1)
            .opacity(configuration.isPressed ? 0.92 : 1)
            .animation(.easeOut(duration: 0.16), value: configuration.isPressed)
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

struct BrandIconView: View {
    @State private var float = false
    @State private var pulse = false

    var body: some View {
        ZStack {
            Circle()
                .fill(
                    LinearGradient(
                        colors: [Color.blue, Color.purple, Color.indigo],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .frame(width: 112, height: 112)
                .shadow(color: .blue.opacity(0.35), radius: 16, x: 0, y: 10)
                .overlay(
                    Circle()
                        .stroke(Color.white.opacity(0.28), lineWidth: 1.6)
                        .scaleEffect(pulse ? 1.14 : 0.96)
                        .opacity(pulse ? 0 : 0.85)
                )

            Circle()
                .fill(Color.white.opacity(0.15))
                .frame(width: 78, height: 78)

            Image(systemName: "bubble.left.and.bubble.right.fill")
                .font(.system(size: 44, weight: .semibold))
                .foregroundStyle(.white)

            Image(systemName: "checkmark.seal.fill")
                .font(.system(size: 20, weight: .bold))
                .foregroundStyle(.white)
                .padding(8)
                .background(Circle().fill(Color.green))
                .overlay(Circle().stroke(Color.white, lineWidth: 2))
                .offset(x: 38, y: 34)
        }
        .offset(y: float ? -4 : 4)
        .onAppear {
            withAnimation(.easeInOut(duration: 2.4).repeatForever(autoreverses: true)) {
                float.toggle()
            }
            withAnimation(.easeOut(duration: 1.8).repeatForever(autoreverses: false)) {
                pulse.toggle()
            }
        }
        .accessibilityHidden(true)
    }
}

// MARK: - Preview

#Preview {
    ContentView()
}
